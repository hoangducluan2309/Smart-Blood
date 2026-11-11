-- ============================================================================
-- SMARTBLOOD - STORED PROCEDURES: PUBLIC CHECK-IN & MEDICAL WORKFLOW
-- ============================================================================

USE HienMauDB;
GO
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ----------------------------------------------------------------------------
-- sp_LookupDonorByCCCD: Tra cuu CCCD + ngay sinh, kiem tra chu ky 84 ngay
-- Khong tiet lo ho so ton tai neu ngay sinh khong khop
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_LookupDonorByCCCD
    @CCCD CHAR(12),
    @NgaySinh DATE,
    @MinIntervalDays INT = 84
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @DonorId UNIQUEIDENTIFIER;
    DECLARE @HoTen NVARCHAR(150);
    DECLARE @GioiTinh NVARCHAR(10);
    DECLARE @SoDienThoai VARCHAR(15);
    DECLARE @DiaChi NVARCHAR(300);
    DECLARE @NhomMau VARCHAR(2);
    DECLARE @RhFactor CHAR(1);
    DECLARE @LaNhomMauHiem BIT;

    SELECT
        @DonorId = id,
        @HoTen = hoTen,
        @GioiTinh = gioiTinh,
        @SoDienThoai = CASE WHEN laNhomMauHiem = 1 THEN NULL ELSE soDienThoai END,
        @DiaChi = CASE WHEN laNhomMauHiem = 1 THEN NULL ELSE diaChi END,
        @NhomMau = nhomMau,
        @RhFactor = rhFactor,
        @LaNhomMauHiem = laNhomMauHiem
    FROM dbo.Donors
    WHERE cccd = @CCCD AND ngaySinh = @NgaySinh;

    -- Khong co ho so hoac sai ngay sinh -> tra ve y het nguoi hien moi
    IF @DonorId IS NULL
    BEGIN
        SELECT
            CAST(0 AS BIT) AS matched,
            CAST(1 AS BIT) AS isNewDonor,
            CAST(1 AS BIT) AS eligible,
            CAST(NULL AS DATE) AS lastDonationDate,
            CAST(NULL AS DATE) AS nextEligibleDate,
            CAST(NULL AS INT) AS daysSinceLastDonation,
            CAST(NULL AS NVARCHAR(150)) AS hoTen,
            CAST(NULL AS DATE) AS ngaySinh,
            CAST(NULL AS NVARCHAR(10)) AS gioiTinh,
            CAST(NULL AS VARCHAR(15)) AS soDienThoai,
            CAST(NULL AS NVARCHAR(300)) AS diaChi,
            CAST(NULL AS VARCHAR(2)) AS nhomMau,
            CAST(NULL AS CHAR(1)) AS rhFactor,
            CAST(0 AS BIT) AS laNhomMauHiem;
        RETURN;
    END;

    DECLARE @LastDonationUTC DATETIME2(3);
    SELECT @LastDonationUTC = MAX(ngayHien)
    FROM dbo.DonationHistory
    WHERE donorId = @DonorId AND trangThai = 'HOAN_THANH';

    IF @LastDonationUTC IS NOT NULL
    BEGIN
        DECLARE @TodayVN DATE = CAST(DATEADD(HOUR, 7, SYSUTCDATETIME()) AS DATE);
        DECLARE @LastDateVN DATE = CAST(DATEADD(HOUR, 7, @LastDonationUTC) AS DATE);
        DECLARE @DaysElapsed INT = DATEDIFF(DAY, @LastDateVN, @TodayVN);
        DECLARE @NextEligible DATE = DATEADD(DAY, @MinIntervalDays, @LastDateVN);

        IF @DaysElapsed < @MinIntervalDays
        BEGIN
            SELECT
                CAST(1 AS BIT) AS matched,
                CAST(0 AS BIT) AS isNewDonor,
                CAST(0 AS BIT) AS eligible,
                @LastDateVN AS lastDonationDate,
                @NextEligible AS nextEligibleDate,
                @DaysElapsed AS daysSinceLastDonation,
                CAST(NULL AS NVARCHAR(150)) AS hoTen,
                CAST(NULL AS DATE) AS ngaySinh,
                CAST(NULL AS NVARCHAR(10)) AS gioiTinh,
                CAST(NULL AS VARCHAR(15)) AS soDienThoai,
                CAST(NULL AS NVARCHAR(300)) AS diaChi,
                CAST(NULL AS VARCHAR(2)) AS nhomMau,
                CAST(NULL AS CHAR(1)) AS rhFactor,
                @LaNhomMauHiem AS laNhomMauHiem;
            RETURN;
        END;
    END;

    SELECT
        CAST(1 AS BIT) AS matched,
        CAST(0 AS BIT) AS isNewDonor,
        CAST(1 AS BIT) AS eligible,
        CAST(DATEADD(HOUR, 7, @LastDonationUTC) AS DATE) AS lastDonationDate,
        CAST(NULL AS DATE) AS nextEligibleDate,
        DATEDIFF(DAY, CAST(DATEADD(HOUR, 7, @LastDonationUTC) AS DATE), CAST(DATEADD(HOUR, 7, SYSUTCDATETIME()) AS DATE)) AS daysSinceLastDonation,
        @HoTen AS hoTen,
        @NgaySinh AS ngaySinh,
        @GioiTinh AS gioiTinh,
        @SoDienThoai AS soDienThoai,
        @DiaChi AS diaChi,
        @NhomMau AS nhomMau,
        @RhFactor AS rhFactor,
        @LaNhomMauHiem AS laNhomMauHiem;
END;
GO

-- ----------------------------------------------------------------------------
-- sp_SubmitDonorCheckIn: Dang ky check-in cong khai (Idempotent, chong ghi de)
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_SubmitDonorCheckIn
    @ClientRequestId UNIQUEIDENTIFIER,
    @EventId UNIQUEIDENTIFIER,
    @CCCD CHAR(12),
    @HoTen NVARCHAR(150),
    @NgaySinh DATE,
    @GioiTinh NVARCHAR(10),
    @SoDienThoai VARCHAR(15),
    @DiaChi NVARCHAR(300),
    @LuongMauDangKy INT,
    @DaDongYXuLyDuLieu BIT,
    @KhaiBaoSucKhoe NVARCHAR(1000),
    @TrackingToken VARCHAR(128),
    @MinIntervalDays INT = 84
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @DaDongYXuLyDuLieu <> 1
        THROW 50020, N'Cần đồng ý xử lý dữ liệu cá nhân theo Nghị định 13/2023 trước khi đăng ký.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Idempotency: neu clientRequestId da ton tai -> tra ket qua cu
        IF EXISTS (SELECT 1 FROM dbo.DonorCheckIns WHERE clientRequestId = @ClientRequestId)
        BEGIN
        SELECT
            c.id AS checkInId,
            c.stt,
            c.thoiGianCheckIn,
            c.trackingToken,
            c.buocHienTai,
            d.id AS donorId,
            d.hoTen,
            d.laNhomMauHiem,
            d.nhomMau,
            d.rhFactor,
            CAST(1 AS BIT) AS isDuplicateRequest
        FROM dbo.DonorCheckIns c
        INNER JOIN dbo.Donors d ON d.id = c.donorId
        WHERE c.clientRequestId = @ClientRequestId;

            COMMIT TRANSACTION;
            RETURN;
        END;

        -- 2. Kiem tra su kien dang mo dung khung gio (UTC+7)
        DECLARE @NowVN DATETIME2(0) = DATEADD(HOUR, 7, SYSUTCDATETIME());
        DECLARE @TodayVN DATE = CAST(@NowVN AS DATE);
        DECLARE @CurrentTimeVN TIME(0) = CAST(@NowVN AS TIME(0));
        DECLARE @EventDate DATE;
        DECLARE @StartTime TIME(0);
        DECLARE @EndTime TIME(0);
        DECLARE @EventStatus VARCHAR(20);

        SELECT
            @EventDate = ngayToChuc,
            @StartTime = gioBatDau,
            @EndTime = gioKetThuc,
            @EventStatus = trangThai
        FROM dbo.DonationEvents WITH (UPDLOCK, ROWLOCK)
        WHERE id = @EventId;

        IF @EventStatus IS NULL
            THROW 50021, N'Không tìm thấy sự kiện hiến máu.', 1;

        IF @EventStatus IN ('COMPLETED', 'CANCELLED')
            THROW 50022, N'Sự kiện hiến máu đã kết thúc hoặc bị hủy.', 1;

        IF @TodayVN <> @EventDate OR @CurrentTimeVN < @StartTime OR @CurrentTimeVN > @EndTime
            THROW 50023, N'Ngoài khung giờ tiếp nhận của sự kiện hiến máu.', 1;

        -- 3. Kiem tra hoac tao ho so Donors
        DECLARE @DonorId UNIQUEIDENTIFIER;
        DECLARE @ExistingDOB DATE;
        DECLARE @IsRare BIT = 0;
        DECLARE @NhomMau VARCHAR(2) = NULL;
        DECLARE @RhFactor CHAR(1) = NULL;

        SELECT
            @DonorId = id,
            @ExistingDOB = ngaySinh,
            @IsRare = laNhomMauHiem,
            @NhomMau = nhomMau,
            @RhFactor = rhFactor
        FROM dbo.Donors WITH (UPDLOCK, ROWLOCK)
        WHERE cccd = @CCCD;

        IF @DonorId IS NULL
        BEGIN
            SET @DonorId = NEWID();
            INSERT INTO dbo.Donors (id, cccd, hoTen, ngaySinh, gioiTinh, soDienThoai, diaChi, laNhomMauHiem)
            VALUES (@DonorId, @CCCD, @HoTen, @NgaySinh, @GioiTinh, @SoDienThoai, @DiaChi, 0);
        END
        ELSE
        BEGIN
            IF @ExistingDOB <> @NgaySinh
                THROW 50024, N'Thông tin CCCD và ngày sinh không khớp hồ sơ. Vui lòng đối chiếu trực tiếp tại bàn tiếp nhận.', 1;

            -- Kiem tra lai chu ky 84 ngay tren server
            DECLARE @LastDonationUTC DATETIME2(3);
            SELECT @LastDonationUTC = MAX(ngayHien)
            FROM dbo.DonationHistory
            WHERE donorId = @DonorId AND trangThai = 'HOAN_THANH';

            IF @LastDonationUTC IS NOT NULL
            BEGIN
                DECLARE @LastDateVN DATE = CAST(DATEADD(HOUR, 7, @LastDonationUTC) AS DATE);
                DECLARE @DaysElapsed INT = DATEDIFF(DAY, @LastDateVN, @TodayVN);
                IF @DaysElapsed < @MinIntervalDays
                BEGIN
                    DECLARE @NextDateStr VARCHAR(10) = CONVERT(VARCHAR(10), DATEADD(DAY, @MinIntervalDays, @LastDateVN), 103);
                    DECLARE @Msg NVARCHAR(250) = CONCAT(N'Chưa đủ khoảng cách an toàn 84 ngày theo Thông tư 26/BYT. Ngày sớm nhất có thể hiến tiếp: ', @NextDateStr);
                    THROW 50025, @Msg, 1;
                END;
            END;

            -- Khong ghi de hoTen, ngaySinh, nhomMau; chi cap nhat lien he neu khong phai mau hiem
            IF @IsRare = 0
            BEGIN
                UPDATE dbo.Donors
                SET soDienThoai = @SoDienThoai,
                    diaChi = @DiaChi,
                    updatedAt = SYSUTCDATETIME()
                WHERE id = @DonorId;
            END;
        END;

        -- 4. Chong check-in trung trong cung su kien
        IF EXISTS (SELECT 1 FROM dbo.DonorCheckIns WHERE eventId = @EventId AND donorId = @DonorId)
            THROW 50026, N'Bạn đã đăng ký check-in tại sự kiện này rồi.', 1;

        -- 5. Cap STT nguyen tu bang bo dem 1 dong tren DonationEvents
        DECLARE @SttTable TABLE (newStt INT);
        UPDATE dbo.DonationEvents
        SET soThuTuHienTai = soThuTuHienTai + 1,
            trangThai = CASE WHEN trangThai = 'UPCOMING' THEN 'ACTIVE' ELSE trangThai END,
            updatedAt = SYSUTCDATETIME()
        OUTPUT inserted.soThuTuHienTai INTO @SttTable(newStt)
        WHERE id = @EventId;

        DECLARE @NewStt INT = (SELECT TOP 1 newStt FROM @SttTable);
        DECLARE @CheckInId UNIQUEIDENTIFIER = NEWID();
        DECLARE @NowUTC DATETIME2(3) = SYSUTCDATETIME();

        INSERT INTO dbo.DonorCheckIns (
            id, eventId, donorId, stt, clientRequestId, thoiGianCheckIn,
            luongMauDangKy, daDongYXuLyDuLieu, khaiBaoSucKhoe, buocHienTai, trackingToken
        )
        VALUES (
            @CheckInId, @EventId, @DonorId, @NewStt, @ClientRequestId, @NowUTC,
            @LuongMauDangKy, @DaDongYXuLyDuLieu, @KhaiBaoSucKhoe, 'CHO_KHAM', @TrackingToken
        );

        COMMIT TRANSACTION;

        SELECT
            @CheckInId AS checkInId,
            @NewStt AS stt,
            @NowUTC AS thoiGianCheckIn,
            @TrackingToken AS trackingToken,
            'CHO_KHAM' AS buocHienTai,
            @DonorId AS donorId,
            @HoTen AS hoTen,
            @IsRare AS laNhomMauHiem,
            @NhomMau AS nhomMau,
            @RhFactor AS rhFactor,
            CAST(0 AS BIT) AS isDuplicateRequest;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_RecordClinicalExam: Buoc 1 - Kham sang loc lam sang & sinh hieu
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_RecordClinicalExam
    @CheckInId UNIQUEIDENTIFIER,
    @BacSiId UNIQUEIDENTIFIER,
    @HuyetApTamThu INT,
    @HuyetApTamTruong INT,
    @NhipTim INT,
    @CanNang DECIMAL(5, 2),
    @TheTichDuocPhep INT = NULL,
    @KetLuan VARCHAR(20),
    @LyDoTuChoi NVARCHAR(500) = NULL,
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @CurrentStep VARCHAR(20);
        DECLARE @EventId UNIQUEIDENTIFIER;

        SELECT @CurrentStep = buocHienTai, @EventId = eventId
        FROM dbo.DonorCheckIns WITH (UPDLOCK, ROWLOCK)
        WHERE id = @CheckInId;

        IF @CurrentStep IS NULL
            THROW 50030, N'Không tìm thấy lượt check-in.', 1;

        IF @CurrentStep <> 'CHO_KHAM'
            THROW 50031, N'Lượt check-in không ở trạng thái chờ khám lâm sàng.', 1;

        IF @KetLuan = 'DAT' AND @TheTichDuocPhep IS NULL
            THROW 50032, N'Phải xác nhận thể tích máu được phép lấy khi đạt khám lâm sàng.', 1;

        INSERT INTO dbo.ClinicalExams (
            id, checkInId, bacSiId, huyetApTamThu, huyetApTamTruong,
            nhipTim, canNang, theTichDuocPhep, ketLuan, lyDoTuChoi
        )
        VALUES (
            NEWID(), @CheckInId, @BacSiId, @HuyetApTamThu, @HuyetApTamTruong,
            @NhipTim, @CanNang, CASE WHEN @KetLuan = 'DAT' THEN @TheTichDuocPhep ELSE NULL END,
            @KetLuan, CASE WHEN @KetLuan = 'TAM_HOAN' THEN @LyDoTuChoi ELSE NULL END
        );

        DECLARE @NextStep VARCHAR(20) = CASE WHEN @KetLuan = 'DAT' THEN 'CHO_XET_NGHIEM' ELSE 'TAM_HOAN' END;

        UPDATE dbo.DonorCheckIns
        SET buocHienTai = @NextStep,
            lyDoTamHoan = CASE WHEN @KetLuan = 'TAM_HOAN' THEN @LyDoTuChoi ELSE NULL END,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @CheckInId;

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(N'checkInId=', @CheckInId, N'; ketLuan=', @KetLuan);
        EXEC dbo.sp_WriteAuditLog @BacSiId, 'CLINICAL_EXAM', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT id AS checkInId, eventId, stt, buocHienTai
        FROM dbo.DonorCheckIns
        WHERE id = @CheckInId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_RecordScreeningTest: Buoc 2 - Xet nghiem nhanh mao mach & ghi nhom mau so bo
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_RecordScreeningTest
    @CheckInId UNIQUEIDENTIFIER,
    @KyThuatVienId UNIQUEIDENTIFIER,
    @Hemoglobin DECIMAL(4, 1),
    @HbsagTest VARCHAR(15),
    @HcvTest VARCHAR(15),
    @HivTest VARCHAR(15),
    @NhomMauSoBo VARCHAR(2),
    @RhFactorSoBo CHAR(1),
    @KetLuan VARCHAR(20),
    @LyDoTamHoan NVARCHAR(500) = NULL,
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @CurrentStep VARCHAR(20);
        DECLARE @DonorId UNIQUEIDENTIFIER;

        SELECT @CurrentStep = buocHienTai, @DonorId = donorId
        FROM dbo.DonorCheckIns WITH (UPDLOCK, ROWLOCK)
        WHERE id = @CheckInId;

        IF @CurrentStep IS NULL
            THROW 50030, N'Không tìm thấy lượt check-in.', 1;

        IF @CurrentStep <> 'CHO_XET_NGHIEM'
            THROW 50033, N'Lượt check-in không ở trạng thái chờ xét nghiệm nhanh.', 1;

        INSERT INTO dbo.ScreeningTests (
            id, checkInId, kyThuatVienId, hemoglobin, hbsagTest,
            hcvTest, hivTest, nhomMauSoBo, rhFactorSoBo, ketLuan
        )
        VALUES (
            NEWID(), @CheckInId, @KyThuatVienId, @Hemoglobin, @HbsagTest,
            @HcvTest, @HivTest, @NhomMauSoBo, @RhFactorSoBo, @KetLuan
        );

        -- Ghi nhom mau so bo; danh dau nhom mau hiem neu Rh- (du lieu lien he se chuyen vao Vault o service)
        DECLARE @IsRare BIT = CASE WHEN @RhFactorSoBo = '-' THEN 1 ELSE 0 END;
        UPDATE dbo.Donors
        SET nhomMau = @NhomMauSoBo,
            rhFactor = @RhFactorSoBo,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @DonorId;

        DECLARE @NextStep VARCHAR(20) = CASE WHEN @KetLuan = 'DAT' THEN 'CHO_LAY_MAU' ELSE 'TAM_HOAN' END;

        UPDATE dbo.DonorCheckIns
        SET buocHienTai = @NextStep,
            lyDoTamHoan = CASE WHEN @KetLuan = 'TAM_HOAN' THEN @LyDoTamHoan ELSE NULL END,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @CheckInId;

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(N'checkInId=', @CheckInId, N'; ketLuan=', @KetLuan);
        EXEC dbo.sp_WriteAuditLog @KyThuatVienId, 'RAPID_SCREENING_TEST', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT
            c.id AS checkInId,
            c.eventId,
            c.stt,
            c.buocHienTai,
            @DonorId AS donorId,
            @IsRare AS isRareBloodCandidate
        FROM dbo.DonorCheckIns c
        WHERE c.id = @CheckInId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

-- ----------------------------------------------------------------------------
-- sp_ProcessBloodBagStockIn: Buoc 3 & 4 - Lay mau, sinh ma tui & nhap kho QUARANTINE
-- ----------------------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.sp_ProcessBloodBagStockIn
    @CheckInId UNIQUEIDENTIFIER,
    @TheTichThucTe INT,
    @ViTriKhoLanhTamThoi NVARCHAR(100) = NULL,
    @CollectedBy UNIQUEIDENTIFIER,
    @DiaChiIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @CurrentStep VARCHAR(20);
        DECLARE @DonorId UNIQUEIDENTIFIER;
        DECLARE @EventId UNIQUEIDENTIFIER;
        DECLARE @Stt INT;
        DECLARE @NhomMau VARCHAR(2);
        DECLARE @RhFactor CHAR(1);

        SELECT
            @CurrentStep = c.buocHienTai,
            @DonorId = c.donorId,
            @EventId = c.eventId,
            @Stt = c.stt,
            @NhomMau = d.nhomMau,
            @RhFactor = d.rhFactor
        FROM dbo.DonorCheckIns c WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.Donors d ON d.id = c.donorId
        WHERE c.id = @CheckInId;

        IF @CurrentStep IS NULL
            THROW 50030, N'Không tìm thấy lượt check-in.', 1;

        IF @CurrentStep <> 'CHO_LAY_MAU'
            THROW 50034, N'Lượt check-in không ở trạng thái chờ lấy máu.', 1;

        IF @NhomMau IS NULL OR @RhFactor IS NULL
            THROW 50035, N'Chưa có nhóm máu sơ bộ từ xét nghiệm nhanh.', 1;

        DECLARE @SeqVal BIGINT = NEXT VALUE FOR dbo.seq_BloodBagSerial;
        DECLARE @YearVN INT = YEAR(DATEADD(HOUR, 7, SYSUTCDATETIME()));
        DECLARE @MaVach VARCHAR(30) = CONCAT('BAG-', @YearVN, '-', RIGHT(CONCAT('000000', @SeqVal), 6));
        DECLARE @NowUTC DATETIME2(3) = SYSUTCDATETIME();
        DECLARE @ExpiryUTC DATETIME2(3) = DATEADD(DAY, 35, @NowUTC);
        DECLARE @BagId UNIQUEIDENTIFIER = NEWID();

        INSERT INTO dbo.BloodBags (
            id, checkInId, maVachTuiMau, qrCode, nhomMau, rhFactor,
            theTich, ngayLayMau, ngayHetHan, trangThai, viTriKhoLanh
        )
        VALUES (
            @BagId, @CheckInId, @MaVach, @MaVach, @NhomMau, @RhFactor,
            @TheTichThucTe, @NowUTC, @ExpiryUTC, 'QUARANTINE', @ViTriKhoLanhTamThoi
        );

        INSERT INTO dbo.DonationHistory (
            id, donorId, checkInId, bloodBagId, ngayHien, theTich, trangThai
        )
        VALUES (
            NEWID(), @DonorId, @CheckInId, @BagId, @NowUTC, @TheTichThucTe, 'HOAN_THANH'
        );

        UPDATE dbo.DonorCheckIns
        SET buocHienTai = 'HOAN_THANH',
            updatedAt = @NowUTC
        WHERE id = @CheckInId;

        UPDATE dbo.DonationEvents
        SET soLuongThucTe = soLuongThucTe + 1,
            updatedAt = @NowUTC
        WHERE id = @EventId;

        DECLARE @LogDetail NVARCHAR(500) = CONCAT(N'bagId=', @BagId, N'; maVach=', @MaVach, N'; status=QUARANTINE');
        EXEC dbo.sp_WriteAuditLog @CollectedBy, 'COLLECT_BLOOD_BAG', @LogDetail, @DiaChiIP;

        COMMIT TRANSACTION;

        SELECT
            @BagId AS bloodBagId,
            @MaVach AS maVachTuiMau,
            @MaVach AS qrPayload,
            @NhomMau AS nhomMau,
            @RhFactor AS rhFactor,
            @TheTichThucTe AS theTich,
            @NowUTC AS ngayLayMau,
            @ExpiryUTC AS ngayHetHan,
            'QUARANTINE' AS trangThai,
            @EventId AS eventId,
            @CheckInId AS checkInId,
            @Stt AS stt;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
