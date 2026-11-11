-- ============================================================================
-- SMARTBLOOD - STORED PROCEDURES: HOSPITAL DISPATCH, EMERGENCY 115 & DONOR AUTH
-- ============================================================================

USE HienMauDB;
GO
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ----------------------------------------------------------------------------
-- sp_CreateEmergencyRequest: Benh vien phat lenh cap cuu hoa toc
-- hospitalId lay tu tai khoan dang nhap (Users.hospitalId)
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_CreateEmergencyRequest
    @RequesterUserId UNIQUEIDENTIFIER,
    @MaBenhAn NVARCHAR(50),
    @NhomMauCan VARCHAR(2),
    @RhFactor CHAR(1),
    @SoLuongTui INT,
    @MucDoKhan VARCHAR(20),
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @HospitalId UNIQUEIDENTIFIER;
        DECLARE @TenBenhVien NVARCHAR(200);

        SELECT @HospitalId = u.hospitalId, @TenBenhVien = h.tenBenhVien
        FROM dbo.Users u
        INNER JOIN dbo.Hospitals h ON h.id = u.hospitalId
        WHERE u.id = @RequesterUserId AND u.vaiTro = 'HOSPITAL_STAFF' AND u.trangThai = 'ACTIVE';

        IF @HospitalId IS NULL
            THROW 50050, N'Tài khoản không gắn với bệnh viện hợp lệ.', 1;

        DECLARE @RequestId UNIQUEIDENTIFIER = NEWID();

        INSERT INTO dbo.EmergencyRequests (
            id, hospitalId, bacSiYeuCauId, maBenhAn, nhomMauCan,
            rhFactor, soLuongTui, mucDoKhan, trangThaiXuLy
        )
        VALUES (
            @RequestId, @HospitalId, @RequesterUserId, @MaBenhAn, @NhomMauCan,
            @RhFactor, @SoLuongTui, @MucDoKhan, 'PENDING'
        );

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(
            N'emergencyId=', @RequestId,
            N'; hospitalId=', @HospitalId,
            N'; blood=', @NhomMauCan, @RhFactor,
            N'; units=', @SoLuongTui,
            N'; level=', @MucDoKhan
        );
        EXEC dbo.sp_WriteAuditLog @RequesterUserId, 'EMERGENCY_ALERT_CREATED', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT
            e.id, e.hospitalId, @TenBenhVien AS tenBenhVien, e.maBenhAn,
            e.nhomMauCan, e.rhFactor, e.soLuongTui, e.mucDoKhan,
            e.trangThaiXuLy, e.createdAt
        FROM dbo.EmergencyRequests e
        WHERE e.id = @RequestId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_AcknowledgeEmergencyRequest: Hoi CTD xac nhan da nhan lenh cap cuu
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_AcknowledgeEmergencyRequest
    @EmergencyRequestId UNIQUEIDENTIFIER,
    @StaffUserId UNIQUEIDENTIFIER,
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Status VARCHAR(25);
        SELECT @Status = trangThaiXuLy
        FROM dbo.EmergencyRequests WITH (UPDLOCK, ROWLOCK)
        WHERE id = @EmergencyRequestId;

        IF @Status IS NULL
            THROW 50051, N'Không tìm thấy lệnh cấp cứu.', 1;

        IF @Status = 'PENDING'
        BEGIN
            UPDATE dbo.EmergencyRequests
            SET trangThaiXuLy = 'ACKNOWLEDGED',
                thoiGianXacNhan = SYSUTCDATETIME(),
                nguoiXacNhanId = @StaffUserId,
                updatedAt = SYSUTCDATETIME()
            WHERE id = @EmergencyRequestId;
        END;

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(N'emergencyId=', @EmergencyRequestId);
        EXEC dbo.sp_WriteAuditLog @StaffUserId, 'EMERGENCY_ACKNOWLEDGED', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT id, trangThaiXuLy, thoiGianXacNhan, nguoiXacNhanId
        FROM dbo.EmergencyRequests
        WHERE id = @EmergencyRequestId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_DispatchBloodBagsFEFO: Xuat kho FEFO voi UPDLOCK, ROWLOCK, READPAST
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_DispatchBloodBagsFEFO
    @HospitalId UNIQUEIDENTIFIER,
    @BloodType VARCHAR(2),
    @RhFactor CHAR(1),
    @UnitsNeeded INT,
    @BienSoXe NVARCHAR(20),
    @TaiXeHotline VARCHAR(15),
    @EmergencyRequestId UNIQUEIDENTIFIER = NULL,
    @DispatchedBy UNIQUEIDENTIFIER,
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.Hospitals WHERE id = @HospitalId AND trangThaiHopTac = 'ACTIVE')
            THROW 50052, N'Bệnh viện tiếp nhận không tồn tại hoặc ngừng hợp tác.', 1;

        DECLARE @DispatchId UNIQUEIDENTIFIER = NEWID();
        DECLARE @SelectedBags TABLE (
            BagId UNIQUEIDENTIFIER,
            MaVachTuiMau VARCHAR(30),
            NgayHetHan DATETIME2(3)
        );

        -- Chon tui can han nhat, khoa dong; READPAST bo qua dong dang bi giao dich khac khoa
        INSERT INTO @SelectedBags (BagId, MaVachTuiMau, NgayHetHan)
        SELECT TOP (@UnitsNeeded) id, maVachTuiMau, ngayHetHan
        FROM dbo.BloodBags WITH (UPDLOCK, ROWLOCK, READPAST)
        WHERE nhomMau = @BloodType
          AND rhFactor = @RhFactor
          AND trangThai = 'IN_STOCK'
          AND ngayHetHan > SYSUTCDATETIME()
        ORDER BY ngayHetHan ASC;

        IF (SELECT COUNT(*) FROM @SelectedBags) < @UnitsNeeded
            THROW 50001, N'Không đủ lượng máu tồn kho đạt chuẩn theo yêu cầu!', 1;

        INSERT INTO dbo.HospitalDispatches (
            id, hospitalId, emergencyRequestId, bienSoXe,
            taiXeHotline, thoiGianXuatKho, trangThaiGiao, dispatchedBy
        )
        VALUES (
            @DispatchId, @HospitalId, @EmergencyRequestId, @BienSoXe,
            @TaiXeHotline, SYSUTCDATETIME(), 'IN_TRANSIT', @DispatchedBy
        );

        INSERT INTO dbo.HospitalDispatchBags (id, dispatchId, bagId)
        SELECT NEWID(), @DispatchId, BagId FROM @SelectedBags;

        UPDATE dbo.BloodBags
        SET trangThai = 'IN_TRANSIT',
            destinationHospitalId = @HospitalId,
            updatedAt = SYSUTCDATETIME()
        WHERE id IN (SELECT BagId FROM @SelectedBags);

        IF @EmergencyRequestId IS NOT NULL
        BEGIN
            UPDATE dbo.EmergencyRequests
            SET trangThaiXuLy = 'DISPATCHED',
                thoiGianXacNhan = COALESCE(thoiGianXacNhan, SYSUTCDATETIME()),
                nguoiXacNhanId = COALESCE(nguoiXacNhanId, @DispatchedBy),
                updatedAt = SYSUTCDATETIME()
            WHERE id = @EmergencyRequestId;
        END;

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(
            N'dispatchId=', @DispatchId,
            N'; hospitalId=', @HospitalId,
            N'; blood=', @BloodType, @RhFactor,
            N'; units=', @UnitsNeeded
        );
        EXEC dbo.sp_WriteAuditLog @DispatchedBy, 'DISPATCH_BLOOD_FEFO', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT @DispatchId AS dispatchId, @HospitalId AS hospitalId, @BienSoXe AS bienSoXe, @TaiXeHotline AS taiXeHotline;
        SELECT BagId AS bagId, MaVachTuiMau AS maVachTuiMau, NgayHetHan AS ngayHetHan FROM @SelectedBags;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_HospitalReceiveBloodBag: Benh vien quet QR nhan tui mau & dong vong lap
-- hospitalId lay tu Users.hospitalId, khong nhan tu client
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_HospitalReceiveBloodBag
    @BagCode VARCHAR(30),
    @ReceiverUserId UNIQUEIDENTIFIER,
    @NhietDo DECIMAL(4, 1),
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @UserHospitalId UNIQUEIDENTIFIER;
        DECLARE @TenBenhVienNhan NVARCHAR(200);

        SELECT @UserHospitalId = u.hospitalId, @TenBenhVienNhan = h.tenBenhVien
        FROM dbo.Users u
        INNER JOIN dbo.Hospitals h ON h.id = u.hospitalId
        WHERE u.id = @ReceiverUserId AND u.vaiTro = 'HOSPITAL_STAFF' AND u.trangThai = 'ACTIVE';

        IF @UserHospitalId IS NULL
            THROW 50050, N'Tài khoản bệnh viện không hợp lệ.', 1;

        DECLARE @BagId UNIQUEIDENTIFIER;
        DECLARE @BagStatus VARCHAR(25);
        DECLARE @DestHospitalId UNIQUEIDENTIFIER;
        DECLARE @CheckInId UNIQUEIDENTIFIER;

        SELECT
            @BagId = id,
            @BagStatus = trangThai,
            @DestHospitalId = destinationHospitalId,
            @CheckInId = checkInId
        FROM dbo.BloodBags WITH (UPDLOCK, ROWLOCK)
        WHERE maVachTuiMau = @BagCode;

        IF @BagId IS NULL
            THROW 50053, N'Không tìm thấy túi máu với mã vạch này.', 1;

        IF @BagStatus <> 'IN_TRANSIT'
            THROW 50054, N'Túi máu không ở trạng thái đang vận chuyển (IN_TRANSIT).', 1;

        IF @DestHospitalId IS NULL OR @DestHospitalId <> @UserHospitalId
        BEGIN
            DECLARE @ExpectedHospital NVARCHAR(200);
            SELECT @ExpectedHospital = tenBenhVien FROM dbo.Hospitals WHERE id = @DestHospitalId;
            DECLARE @ErrMsg NVARCHAR(300) = CONCAT(
                N'Cảnh báo: Túi máu này được điều phối cho ',
                ISNULL(@ExpectedHospital, N'bệnh viện khác'),
                N'. Vui lòng kiểm tra lại với tài xế xe 115.'
            );
            THROW 50055, @ErrMsg, 1;
        END;

        DECLARE @NowUTC DATETIME2(3) = SYSUTCDATETIME();

        UPDATE dbo.BloodBags
        SET trangThai = 'HOSPITAL_RECEIVED',
            updatedAt = @NowUTC
        WHERE id = @BagId;

        DECLARE @DispatchId UNIQUEIDENTIFIER;
        SELECT TOP 1 @DispatchId = hdb.dispatchId
        FROM dbo.HospitalDispatchBags hdb WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.HospitalDispatches hd ON hd.id = hdb.dispatchId
        WHERE hdb.bagId = @BagId
        ORDER BY hd.thoiGianXuatKho DESC;

        UPDATE dbo.HospitalDispatchBags
        SET thoiGianTiepNhan = @NowUTC,
            nhanVienNhanId = @ReceiverUserId,
            nhietDoGhiNhan = @NhietDo
        WHERE dispatchId = @DispatchId AND bagId = @BagId;

        -- Cap nhat trang thai lenh xuat neu tat ca cac tui da nhan
        IF EXISTS (
            SELECT 1 FROM dbo.HospitalDispatchBags
            WHERE dispatchId = @DispatchId AND thoiGianTiepNhan IS NULL
        )
        BEGIN
            UPDATE dbo.HospitalDispatches
            SET trangThaiGiao = 'PARTIAL_RECEIVED', updatedAt = @NowUTC
            WHERE id = @DispatchId;
        END
        ELSE
        BEGIN
            UPDATE dbo.HospitalDispatches
            SET trangThaiGiao = 'DELIVERED', updatedAt = @NowUTC
            WHERE id = @DispatchId;

            UPDATE dbo.EmergencyRequests
            SET trangThaiXuLy = 'COMPLETED', updatedAt = @NowUTC
            WHERE id = (SELECT emergencyRequestId FROM dbo.HospitalDispatches WHERE id = @DispatchId)
              AND trangThaiXuLy = 'DISPATCHED';
        END;

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(
            N'bagCode=', @BagCode,
            N'; hospitalId=', @UserHospitalId,
            N'; tempC=', @NhietDo
        );
        EXEC dbo.sp_WriteAuditLog @ReceiverUserId, 'HOSPITAL_RECEIVE_BAG', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT
            b.id AS bagId,
            b.maVachTuiMau,
            b.nhomMau,
            b.rhFactor,
            b.theTich,
            b.trangThai,
            @TenBenhVienNhan AS tenBenhVien,
            @NowUTC AS thoiGianTiepNhan,
            d.hoTen AS donorName,
            d.laNhomMauHiem,
            CASE WHEN d.laNhomMauHiem = 1 THEN NULL ELSE d.soDienThoai END AS donorPhone,
            u.email AS donorEmail
        FROM dbo.BloodBags b
        INNER JOIN dbo.DonorCheckIns c ON c.id = b.checkInId
        INNER JOIN dbo.Donors d ON d.id = c.donorId
        LEFT JOIN dbo.Users u ON u.id = d.userId
        WHERE b.id = @BagId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_RegisterDonorAccount: Dang ky tai khoan lien ket ho so CCCD (PENDING_VERIFY)
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_RegisterDonorAccount
    @CCCD CHAR(12),
    @NgaySinh DATE,
    @Email NVARCHAR(255),
    @MatKhauHash VARCHAR(255),
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (SELECT 1 FROM dbo.Users WHERE email = @Email)
            THROW 50060, N'Email đã được sử dụng.', 1;

        DECLARE @DonorId UNIQUEIDENTIFIER;
        DECLARE @ExistingUserId UNIQUEIDENTIFIER;

        SELECT @DonorId = id, @ExistingUserId = userId
        FROM dbo.Donors WITH (UPDLOCK, ROWLOCK)
        WHERE cccd = @CCCD AND ngaySinh = @NgaySinh;

        -- Khong tiet lo chi tiet vi sao khong khop
        IF @DonorId IS NULL OR @ExistingUserId IS NOT NULL
            THROW 50061, N'Thông tin xác minh hồ sơ hiến máu không hợp lệ hoặc đã có tài khoản liên kết.', 1;

        DECLARE @UserId UNIQUEIDENTIFIER = NEWID();

        INSERT INTO dbo.Users (
            id, email, matKhauHash, vaiTro, hospitalId,
            laNguoiPheDuyet, emailDaXacThuc, trangThai
        )
        VALUES (
            @UserId, @Email, @MatKhauHash, 'REGISTERED_DONOR', NULL,
            0, 0, 'PENDING_VERIFY'
        );

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(N'userId=', @UserId, N'; role=REGISTERED_DONOR');
        EXEC dbo.sp_WriteAuditLog @UserId, 'DONOR_REGISTER_PENDING', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT @UserId AS userId, @DonorId AS donorId, @Email AS email, 'PENDING_VERIFY' AS trangThai;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_ActivateDonorAccount: Xac minh OTP email -> ACTIVE va lien ket lich su cu
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_ActivateDonorAccount
    @UserId UNIQUEIDENTIFIER,
    @CCCD CHAR(12),
    @NgaySinh DATE,
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @DonorId UNIQUEIDENTIFIER;
        SELECT @DonorId = id
        FROM dbo.Donors WITH (UPDLOCK, ROWLOCK)
        WHERE cccd = @CCCD AND ngaySinh = @NgaySinh AND userId IS NULL;

        IF @DonorId IS NULL
            THROW 50062, N'Không tìm thấy hồ sơ người hiến hợp lệ để liên kết.', 1;

        UPDATE dbo.Users
        SET emailDaXacThuc = 1,
            trangThai = 'ACTIVE',
            updatedAt = SYSUTCDATETIME()
        WHERE id = @UserId AND trangThai = 'PENDING_VERIFY';

        IF @@ROWCOUNT = 0
            THROW 50063, N'Tài khoản không ở trạng thái chờ xác minh.', 1;

        UPDATE dbo.Donors
        SET userId = @UserId,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @DonorId;

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(N'userId=', @UserId, N'; donorId=', @DonorId);
        EXEC dbo.sp_WriteAuditLog @UserId, 'DONOR_ACCOUNT_ACTIVATED', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT @UserId AS userId, @DonorId AS donorId, 'ACTIVE' AS trangThai;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_UpdateUserPassword: Cap nhat mat khau moi sau khi xac thuc OTP quen mat khau
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_UpdateUserPassword
    @UserId UNIQUEIDENTIFIER,
    @MatKhauHash VARCHAR(255),
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        UPDATE dbo.Users
        SET matKhauHash = @MatKhauHash,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @UserId;

        IF @@ROWCOUNT = 0
            THROW 50064, N'Không tìm thấy tài khoản người dùng.', 1;

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(N'userId=', @UserId);
        EXEC dbo.sp_WriteAuditLog @UserId, 'PASSWORD_RESET_COMPLETED', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_AdminUpdateUserStatus: Admin khoa / mo khoa tai khoan thu cong
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_AdminUpdateUserStatus
    @AdminId UNIQUEIDENTIFIER,
    @TargetUserId UNIQUEIDENTIFIER,
    @TrangThai VARCHAR(20),
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (
            SELECT 1 FROM dbo.Users
            WHERE id = @AdminId AND vaiTro = 'ADMIN' AND trangThai = 'ACTIVE'
        )
            THROW 50066, N'Tài khoản quản trị không hợp lệ.', 1;

        IF @AdminId = @TargetUserId AND @TrangThai = 'LOCKED'
            THROW 50065, N'Không thể tự khóa tài khoản quản trị đang đăng nhập.', 1;

        UPDATE dbo.Users
        SET trangThai = @TrangThai,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @TargetUserId;

        IF @@ROWCOUNT = 0
            THROW 50064, N'Không tìm thấy tài khoản người dùng.', 1;

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(
            N'targetUserId=', @TargetUserId,
            N'; newStatus=', @TrangThai
        );
        EXEC dbo.sp_WriteAuditLog @AdminId, 'ADMIN_UPDATE_USER_STATUS', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT id, email, vaiTro, hospitalId, laNguoiPheDuyet, emailDaXacThuc, trangThai
        FROM dbo.Users
        WHERE id = @TargetUserId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
