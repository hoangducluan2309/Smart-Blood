-- ============================================================================
-- SMARTBLOOD - STORED PROCEDURES: INVENTORY FEFO & RARE BLOOD VAULT
-- ============================================================================

USE HienMauDB;
GO
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ----------------------------------------------------------------------------
-- sp_RecordBloodBagLabResult: Duyet tui mau cach ly sau xet nghiem sang loc
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_RecordBloodBagLabResult
    @BloodBagId UNIQUEIDENTIFIER,
    @KetQuaSangLoc VARCHAR(20),
    @NhomMauChinhThuc VARCHAR(2),
    @RhFactorChinhThuc CHAR(1),
    @ViTriKhoLanh NVARCHAR(100) = NULL,
    @ReviewedBy UNIQUEIDENTIFIER,
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @CurrentStatus VARCHAR(25);
        DECLARE @DonorId UNIQUEIDENTIFIER;

        SELECT @CurrentStatus = b.trangThai, @DonorId = c.donorId
        FROM dbo.BloodBags b WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.DonorCheckIns c ON c.id = b.checkInId
        WHERE b.id = @BloodBagId;

        IF @CurrentStatus IS NULL
            THROW 50040, N'Không tìm thấy túi máu.', 1;

        IF @CurrentStatus <> 'QUARANTINE'
            THROW 50041, N'Chỉ túi máu ở trạng thái cách ly (QUARANTINE) mới được nhập kết quả sàng lọc.', 1;

        DECLARE @NextStatus VARCHAR(25) = CASE WHEN @KetQuaSangLoc = 'DAT' THEN 'IN_STOCK' ELSE 'DISCARDED' END;

        UPDATE dbo.BloodBags
        SET ketQuaSangLoc = @KetQuaSangLoc,
            nhomMau = @NhomMauChinhThuc,
            rhFactor = @RhFactorChinhThuc,
            trangThai = @NextStatus,
            viTriKhoLanh = COALESCE(@ViTriKhoLanh, viTriKhoLanh),
            updatedAt = SYSUTCDATETIME()
        WHERE id = @BloodBagId;

        IF @KetQuaSangLoc = 'DAT'
        BEGIN
            UPDATE dbo.Donors
            SET nhomMau = @NhomMauChinhThuc,
                rhFactor = @RhFactorChinhThuc,
                updatedAt = SYSUTCDATETIME()
            WHERE id = @DonorId;
        END;

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(N'bloodBagId=', @BloodBagId, N'; ketQua=', @KetQuaSangLoc, N'; nextStatus=', @NextStatus);
        EXEC dbo.sp_WriteAuditLog @ReviewedBy, 'BLOOD_BAG_LAB_RESULT', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT
            id, maVachTuiMau, nhomMau, rhFactor, trangThai,
            ketQuaSangLoc, ngayHetHan, @DonorId AS donorId
        FROM dbo.BloodBags
        WHERE id = @BloodBagId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_UpsertRareBloodVault: Chuyen thong tin lien he nhom mau hiem vao ket ma hoa
-- va xoa NULL tren bang Donors (Zero-Trust)
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_UpsertRareBloodVault
    @DonorId UNIQUEIDENTIFIER,
    @NhomMauHiem VARCHAR(20),
    @KeyVersion INT,
    @EncryptedPhone VARBINARY(512),
    @IvPhone VARBINARY(16),
    @AuthTagPhone VARBINARY(32),
    @EncryptedAddress VARBINARY(1024),
    @IvAddress VARBINARY(16),
    @AuthTagAddress VARBINARY(32),
    @ActorId UNIQUEIDENTIFIER = NULL,
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.Donors WHERE id = @DonorId)
            THROW 50042, N'Không tìm thấy hồ sơ người hiến máu.', 1;

        IF EXISTS (SELECT 1 FROM dbo.RareBloodVault WITH (UPDLOCK, ROWLOCK) WHERE donorId = @DonorId)
        BEGIN
            UPDATE dbo.RareBloodVault
            SET nhomMauHiem = @NhomMauHiem,
                keyVersion = @KeyVersion,
                encryptedPhone = @EncryptedPhone,
                ivPhone = @IvPhone,
                authTagPhone = @AuthTagPhone,
                encryptedAddress = @EncryptedAddress,
                ivAddress = @IvAddress,
                authTagAddress = @AuthTagAddress,
                updatedAt = SYSUTCDATETIME()
            WHERE donorId = @DonorId;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.RareBloodVault (
                id, donorId, nhomMauHiem, keyVersion,
                encryptedPhone, ivPhone, authTagPhone,
                encryptedAddress, ivAddress, authTagAddress
            )
            VALUES (
                NEWID(), @DonorId, @NhomMauHiem, @KeyVersion,
                @EncryptedPhone, @IvPhone, @AuthTagPhone,
                @EncryptedAddress, @IvAddress, @AuthTagAddress
            );
        END;

        UPDATE dbo.Donors
        SET laNhomMauHiem = 1,
            soDienThoai = NULL,
            diaChi = NULL,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @DonorId;

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(N'donorId=', @DonorId, N'; nhomMauHiem=', @NhomMauHiem, N'; keyVersion=', @KeyVersion);
        EXEC dbo.sp_WriteAuditLog @ActorId, 'VAULT_SEAL_DONOR', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_RequestRareBloodVaultUnlock: Buoc 1 mo ket 2 lop (Admin yeu cau)
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_RequestRareBloodVaultUnlock
    @RequesterId UNIQUEIDENTIFIER,
    @DonorId UNIQUEIDENTIFIER,
    @MaBenhAn NVARCHAR(50),
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.RareBloodVault WHERE donorId = @DonorId)
            THROW 50043, N'Người hiến không có hồ sơ trong Két máu hiếm.', 1;

        DECLARE @RequestId UNIQUEIDENTIFIER = NEWID();

        INSERT INTO dbo.VaultUnlockRequests (id, requesterId, donorId, maBenhAn, trangThai)
        VALUES (@RequestId, @RequesterId, @DonorId, @MaBenhAn, 'PENDING');

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(N'requestId=', @RequestId, N'; donorId=', @DonorId, N'; maBenhAn=', @MaBenhAn);
        EXEC dbo.sp_WriteAuditLog @RequesterId, 'VAULT_UNLOCK_REQUESTED', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT id AS requestId, requesterId, donorId, maBenhAn, trangThai, createdAt
        FROM dbo.VaultUnlockRequests
        WHERE id = @RequestId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_ApproveVaultUnlock: Buoc 2 mo ket (Nguoi phe duyet khac voi nguoi yeu cau)
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_ApproveVaultUnlock
    @RequestId UNIQUEIDENTIFIER,
    @ApproverId UNIQUEIDENTIFIER,
    @GrantMinutes INT = 15,
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @RequesterId UNIQUEIDENTIFIER;
        DECLARE @CurrentStatus VARCHAR(20);
        DECLARE @MaBenhAn NVARCHAR(50);

        SELECT @RequesterId = requesterId, @CurrentStatus = trangThai, @MaBenhAn = maBenhAn
        FROM dbo.VaultUnlockRequests WITH (UPDLOCK, ROWLOCK)
        WHERE id = @RequestId;

        IF @RequesterId IS NULL
            THROW 50044, N'Không tìm thấy yêu cầu mở két máu hiếm.', 1;

        IF @RequesterId = @ApproverId
            THROW 50045, N'Người phê duyệt phải là tài khoản lãnh đạo khác với người yêu cầu.', 1;

        IF @CurrentStatus <> 'PENDING'
            THROW 50046, N'Yêu cầu mở két không ở trạng thái chờ phê duyệt.', 1;

        DECLARE @NowUTC DATETIME2(3) = SYSUTCDATETIME();
        DECLARE @ExpiresAt DATETIME2(3) = DATEADD(MINUTE, @GrantMinutes, @NowUTC);

        UPDATE dbo.VaultUnlockRequests
        SET approverId = @ApproverId,
            trangThai = 'APPROVED',
            approvedAt = @NowUTC,
            expiresAt = @ExpiresAt
        WHERE id = @RequestId;

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(
            N'requestId=', @RequestId,
            N'; requesterId=', @RequesterId,
            N'; maBenhAn=', @MaBenhAn,
            N'; expiresAt=', CONVERT(NVARCHAR(30), @ExpiresAt, 127)
        );
        EXEC dbo.sp_WriteAuditLog @ApproverId, 'VAULT_UNLOCK_APPROVED', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT id AS requestId, requesterId, approverId, donorId, maBenhAn, trangThai, approvedAt, expiresAt
        FROM dbo.VaultUnlockRequests
        WHERE id = @RequestId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_GetRareBloodVaultForReveal: Buoc 3 lay du lieu ma hoa trong han 15 phut
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_GetRareBloodVaultForReveal
    @RequestId UNIQUEIDENTIFIER,
    @ViewerId UNIQUEIDENTIFIER,
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @RequesterId UNIQUEIDENTIFIER;
        DECLARE @DonorId UNIQUEIDENTIFIER;
        DECLARE @Status VARCHAR(20);
        DECLARE @ExpiresAt DATETIME2(3);
        DECLARE @MaBenhAn NVARCHAR(50);

        SELECT
            @RequesterId = requesterId,
            @DonorId = donorId,
            @Status = trangThai,
            @ExpiresAt = expiresAt,
            @MaBenhAn = maBenhAn
        FROM dbo.VaultUnlockRequests WITH (UPDLOCK, ROWLOCK)
        WHERE id = @RequestId;

        IF @RequesterId IS NULL
            THROW 50044, N'Không tìm thấy yêu cầu mở két máu hiếm.', 1;

        IF @RequesterId <> @ViewerId
            THROW 50047, N'Chỉ người yêu cầu hợp lệ mới được xem thông tin từ két.', 1;

        IF @Status <> 'APPROVED' OR @ExpiresAt IS NULL OR @ExpiresAt <= SYSUTCDATETIME()
        BEGIN
            IF @Status = 'APPROVED' AND @ExpiresAt <= SYSUTCDATETIME()
            BEGIN
                UPDATE dbo.VaultUnlockRequests SET trangThai = 'EXPIRED' WHERE id = @RequestId;
            END;
            THROW 50048, N'Quyền xem két máu hiếm đã hết hạn hoặc chưa được phê duyệt.', 1;
        END;

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(N'requestId=', @RequestId, N'; donorId=', @DonorId, N'; maBenhAn=', @MaBenhAn);
        EXEC dbo.sp_WriteAuditLog @ViewerId, 'VAULT_REVEAL_VIEWED', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT
            v.donorId,
            d.hoTen,
            v.nhomMauHiem,
            v.keyVersion,
            v.encryptedPhone,
            v.ivPhone,
            v.authTagPhone,
            v.encryptedAddress,
            v.ivAddress,
            v.authTagAddress,
            @ExpiresAt AS expiresAt
        FROM dbo.RareBloodVault v
        INNER JOIN dbo.Donors d ON d.id = v.donorId
        WHERE v.donorId = @DonorId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
