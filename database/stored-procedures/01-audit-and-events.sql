-- ============================================================================
-- SMARTBLOOD - STORED PROCEDURES: AUDIT LOGS & DONATION EVENTS
-- ============================================================================

USE HienMauDB;
GO
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ----------------------------------------------------------------------------
-- sp_WriteAuditLog: Ghi nhat ky kiem toan bat bien voi chuoi SHA-256
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_WriteAuditLog
    @UserId UNIQUEIDENTIFIER = NULL,
    @HanhDong VARCHAR(60),
    @ChiTiet NVARCHAR(2000),
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @LockResult INT;
    DECLARE @HashTruoc CHAR(64) = REPLICATE('0', 64);
    DECLARE @Now DATETIME2(7) = SYSUTCDATETIME();
    DECLARE @Payload NVARCHAR(MAX);
    DECLARE @Hash CHAR(64);

    BEGIN TRY
        DECLARE @StartedTran BIT = 0;
        IF @@TRANCOUNT = 0
        BEGIN
            BEGIN TRANSACTION;
            SET @StartedTran = 1;
        END;

        EXEC @LockResult = sp_getapplock
            @Resource = N'AuditLogsChain',
            @LockMode = 'Exclusive',
            @LockOwner = 'Transaction',
            @LockTimeout = 5000;

        IF @LockResult < 0
            THROW 50099, N'Không thể khóa chuỗi nhật ký kiểm toán.', 1;

        SELECT TOP 1 @HashTruoc = [hash]
        FROM dbo.AuditLogs WITH (UPDLOCK, HOLDLOCK)
        ORDER BY thoiGianTao DESC, id DESC;

        SET @Payload = CONCAT(
            @HashTruoc, N'|',
            ISNULL(CONVERT(NVARCHAR(36), @UserId), N'SYSTEM'), N'|',
            @HanhDong, N'|',
            @ChiTiet, N'|',
            ISNULL(@DiaChiIP, N''), N'|',
            CONVERT(NVARCHAR(30), @Now, 127)
        );

        SET @Hash = LOWER(CONVERT(CHAR(64), HASHBYTES('SHA2_256', @Payload), 2));

        INSERT INTO dbo.AuditLogs (userId, hanhDong, chiTiet, diaChiIP, thoiGianTao, hashTruoc, [hash])
        VALUES (@UserId, @HanhDong, @ChiTiet, @DiaChiIP, @Now, @HashTruoc, @Hash);

        IF @StartedTran = 1
            COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @StartedTran = 1 AND @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_CreateDonationEvent: Tao su kien hien mau moi & ma su kien duy nhat
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_CreateDonationEvent
    @TenSuKien NVARCHAR(200),
    @DiaDiem NVARCHAR(200),
    @DiaChiChiTiet NVARCHAR(300) = NULL,
    @NgayToChuc DATE,
    @GioBatDau TIME(0),
    @GioKetThuc TIME(0),
    @ChiTieuSoLuong INT,
    @GhiChu NVARCHAR(500) = NULL,
    @CreatedBy UNIQUEIDENTIFIER,
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @TodayVN DATE = CAST(DATEADD(HOUR, 7, SYSUTCDATETIME()) AS DATE);
    IF @NgayToChuc < @TodayVN
        THROW 50010, N'Ngày tổ chức sự kiện không được ở quá khứ.', 1;

    IF @GioKetThuc <= @GioBatDau
        THROW 50011, N'Giờ kết thúc phải sau giờ bắt đầu.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @EventId UNIQUEIDENTIFIER = NEWID();
        DECLARE @YearMonth CHAR(6) = FORMAT(@NgayToChuc, 'yyyyMM');
        DECLARE @SeqCount INT;

        SELECT @SeqCount = COUNT(*) + 1
        FROM dbo.DonationEvents WITH (UPDLOCK, HOLDLOCK)
        WHERE FORMAT(ngayToChuc, 'yyyyMM') = @YearMonth;

        DECLARE @MaSuKien VARCHAR(40) = CONCAT('SK-BH-', @YearMonth, '-', RIGHT(CONCAT('000', @SeqCount), 3));
        DECLARE @QrCodeUrl NVARCHAR(500) = CONCAT(N'/api/v1/events/', CONVERT(NVARCHAR(36), @EventId), N'/qr-download');
        DECLARE @TrangThai VARCHAR(20) = CASE WHEN @NgayToChuc = @TodayVN THEN 'ACTIVE' ELSE 'UPCOMING' END;

        INSERT INTO dbo.DonationEvents (
            id, maSuKien, tenSuKien, diaDiem, diaChiChiTiet,
            ngayToChuc, gioBatDau, gioKetThuc, chiTieuSoLuong,
            soLuongThucTe, soThuTuHienTai, qrCodeUrl, ghiChu, trangThai
        )
        VALUES (
            @EventId, @MaSuKien, @TenSuKien, @DiaDiem, @DiaChiChiTiet,
            @NgayToChuc, @GioBatDau, @GioKetThuc, @ChiTieuSoLuong,
            0, 0, @QrCodeUrl, @GhiChu, @TrangThai
        );

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(N'eventId=', @EventId, N'; maSuKien=', @MaSuKien);
        EXEC dbo.sp_WriteAuditLog @CreatedBy, 'CREATE_EVENT', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT
            id, maSuKien, tenSuKien, diaDiem, diaChiChiTiet,
            ngayToChuc, CONVERT(VARCHAR(8), gioBatDau, 108) AS gioBatDau,
            CONVERT(VARCHAR(8), gioKetThuc, 108) AS gioKetThuc,
            chiTieuSoLuong, soLuongThucTe, qrCodeUrl, ghiChu, trangThai, createdAt
        FROM dbo.DonationEvents
        WHERE id = @EventId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_UpdateDonationEventStatus: Cap nhat trang thai su kien
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_UpdateDonationEventStatus
    @EventId UNIQUEIDENTIFIER,
    @TrangThai VARCHAR(20),
    @UpdatedBy UNIQUEIDENTIFIER,
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.DonationEvents WHERE id = @EventId)
            THROW 50012, N'Không tìm thấy sự kiện hiến máu.', 1;

        UPDATE dbo.DonationEvents
        SET trangThai = @TrangThai,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @EventId;

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(N'eventId=', @EventId, N'; trangThai=', @TrangThai);
        EXEC dbo.sp_WriteAuditLog @UpdatedBy, 'UPDATE_EVENT_STATUS', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT id, maSuKien, trangThai, updatedAt
        FROM dbo.DonationEvents
        WHERE id = @EventId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
