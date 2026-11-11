-- ============================================================================
-- SMARTBLOOD - KICH BAN KHOI TAO CO SO DU LIEU HienMauDB (MSSQL 2019)
-- Nguon su that duy nhat: Architechture.md muc 5 (15 bang quan he + View)
-- Quy uoc thoi gian: DATETIME2(3) UTC (SYSUTCDATETIME()), so sanh ngay theo UTC+7
-- ============================================================================

IF DB_ID(N'HienMauDB') IS NULL
BEGIN
    CREATE DATABASE HienMauDB;
END;
GO

USE HienMauDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- Sequence sinh ma tui mau noi bo: BAG-<nam>-<6 chu so>
IF OBJECT_ID(N'dbo.seq_BloodBagSerial', N'SO') IS NULL
BEGIN
    CREATE SEQUENCE dbo.seq_BloodBagSerial
        AS BIGINT
        START WITH 1
        INCREMENT BY 1
        MINVALUE 1
        NO CYCLE;
END;
GO

-- 1. Hospitals
IF OBJECT_ID(N'dbo.Hospitals', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Hospitals (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_Hospitals PRIMARY KEY DEFAULT NEWID(),
        tenBenhVien NVARCHAR(200) NOT NULL,
        diaChi NVARCHAR(300) NOT NULL,
        hotlineCapCuu VARCHAR(20) NOT NULL,
        toaDoLat DECIMAL(9, 6) NULL,
        toaDoLng DECIMAL(9, 6) NULL,
        trangThaiHopTac VARCHAR(20) NOT NULL
            CONSTRAINT chk_Hospitals_trangThai CHECK (trangThaiHopTac IN ('ACTIVE', 'INACTIVE'))
            DEFAULT 'ACTIVE',
        createdAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
GO

-- 2. Users
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_Users PRIMARY KEY DEFAULT NEWID(),
        email NVARCHAR(255) NOT NULL,
        matKhauHash VARCHAR(255) NOT NULL,
        vaiTro VARCHAR(30) NOT NULL
            CONSTRAINT chk_Users_vaiTro CHECK (
                vaiTro IN ('ADMIN', 'RED_CROSS_STAFF', 'HOSPITAL_STAFF', 'REGISTERED_DONOR')
            ),
        hospitalId UNIQUEIDENTIFIER NULL,
        laNguoiPheDuyet BIT NOT NULL DEFAULT 0,
        emailDaXacThuc BIT NOT NULL DEFAULT 0,
        trangThai VARCHAR(20) NOT NULL
            CONSTRAINT chk_Users_trangThai CHECK (
                trangThai IN ('PENDING_VERIFY', 'ACTIVE', 'LOCKED')
            )
            DEFAULT 'PENDING_VERIFY',
        createdAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT uniq_Users_email UNIQUE (email),
        CONSTRAINT fk_Users_Hospitals FOREIGN KEY (hospitalId) REFERENCES dbo.Hospitals(id),
        CONSTRAINT chk_Users_HospitalStaff_Hospital CHECK (
            vaiTro <> 'HOSPITAL_STAFF' OR hospitalId IS NOT NULL
        ),
        CONSTRAINT chk_Users_Approver_Admin CHECK (
            laNguoiPheDuyet = 0 OR vaiTro = 'ADMIN'
        )
    );
    CREATE INDEX idx_Users_vaiTro_trangThai ON dbo.Users(vaiTro, trangThai);
END;
GO

-- 3. Donors
IF OBJECT_ID(N'dbo.Donors', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Donors (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_Donors PRIMARY KEY DEFAULT NEWID(),
        cccd CHAR(12) NOT NULL,
        hoTen NVARCHAR(150) NOT NULL,
        ngaySinh DATE NOT NULL,
        gioiTinh NVARCHAR(10) NOT NULL
            CONSTRAINT chk_Donors_gioiTinh CHECK (gioiTinh IN (N'NAM', N'NU', N'KHAC')),
        soDienThoai VARCHAR(15) NULL,
        diaChi NVARCHAR(300) NULL,
        nhomMau VARCHAR(2) NULL
            CONSTRAINT chk_Donors_nhomMau CHECK (nhomMau IS NULL OR nhomMau IN ('A', 'B', 'AB', 'O')),
        rhFactor CHAR(1) NULL
            CONSTRAINT chk_Donors_rhFactor CHECK (rhFactor IS NULL OR rhFactor IN ('+', '-')),
        laNhomMauHiem BIT NOT NULL DEFAULT 0,
        userId UNIQUEIDENTIFIER NULL,
        createdAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT uniq_Donors_cccd UNIQUE (cccd),
        CONSTRAINT fk_Donors_Users FOREIGN KEY (userId) REFERENCES dbo.Users(id),
        CONSTRAINT chk_Donors_RareVault_NullContact CHECK (
            laNhomMauHiem = 0 OR (soDienThoai IS NULL AND diaChi IS NULL)
        )
    );
    CREATE INDEX idx_Donors_soDienThoai ON dbo.Donors(soDienThoai) WHERE soDienThoai IS NOT NULL;
    CREATE INDEX idx_Donors_userId ON dbo.Donors(userId) WHERE userId IS NOT NULL;
END;
GO

-- 4. RareBloodVault
IF OBJECT_ID(N'dbo.RareBloodVault', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RareBloodVault (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_RareBloodVault PRIMARY KEY DEFAULT NEWID(),
        donorId UNIQUEIDENTIFIER NOT NULL,
        nhomMauHiem VARCHAR(20) NOT NULL,
        keyVersion INT NOT NULL DEFAULT 1,
        encryptedPhone VARBINARY(512) NOT NULL,
        ivPhone VARBINARY(16) NOT NULL,
        authTagPhone VARBINARY(32) NOT NULL,
        encryptedAddress VARBINARY(1024) NOT NULL,
        ivAddress VARBINARY(16) NOT NULL,
        authTagAddress VARBINARY(32) NOT NULL,
        createdAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT uniq_RareBloodVault_donorId UNIQUE (donorId),
        CONSTRAINT fk_RareBloodVault_Donors FOREIGN KEY (donorId) REFERENCES dbo.Donors(id)
    );
END;
GO

-- 5. VaultUnlockRequests
IF OBJECT_ID(N'dbo.VaultUnlockRequests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VaultUnlockRequests (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_VaultUnlockRequests PRIMARY KEY DEFAULT NEWID(),
        requesterId UNIQUEIDENTIFIER NOT NULL,
        approverId UNIQUEIDENTIFIER NULL,
        donorId UNIQUEIDENTIFIER NOT NULL,
        maBenhAn NVARCHAR(50) NOT NULL,
        trangThai VARCHAR(20) NOT NULL
            CONSTRAINT chk_VaultUnlockRequests_trangThai CHECK (
                trangThai IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')
            )
            DEFAULT 'PENDING',
        createdAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        approvedAt DATETIME2(3) NULL,
        expiresAt DATETIME2(3) NULL,
        CONSTRAINT fk_VaultUnlockRequests_Requester FOREIGN KEY (requesterId) REFERENCES dbo.Users(id),
        CONSTRAINT fk_VaultUnlockRequests_Approver FOREIGN KEY (approverId) REFERENCES dbo.Users(id),
        CONSTRAINT fk_VaultUnlockRequests_Donors FOREIGN KEY (donorId) REFERENCES dbo.Donors(id),
        CONSTRAINT chk_VaultUnlockRequests_DualCustody CHECK (
            approverId IS NULL OR requesterId <> approverId
        )
    );
    CREATE INDEX idx_VaultUnlockRequests_trangThai_expiresAt
        ON dbo.VaultUnlockRequests(trangThai, expiresAt);
END;
GO

-- 6. DonationEvents
IF OBJECT_ID(N'dbo.DonationEvents', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DonationEvents (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_DonationEvents PRIMARY KEY DEFAULT NEWID(),
        maSuKien VARCHAR(40) NOT NULL,
        tenSuKien NVARCHAR(200) NOT NULL,
        diaDiem NVARCHAR(200) NOT NULL,
        diaChiChiTiet NVARCHAR(300) NULL,
        ngayToChuc DATE NOT NULL,
        gioBatDau TIME(0) NOT NULL,
        gioKetThuc TIME(0) NOT NULL,
        chiTieuSoLuong INT NOT NULL CONSTRAINT chk_DonationEvents_chiTieu CHECK (chiTieuSoLuong > 0),
        soLuongThucTe INT NOT NULL DEFAULT 0,
        soThuTuHienTai INT NOT NULL DEFAULT 0,
        qrCodeUrl NVARCHAR(500) NULL,
        ghiChu NVARCHAR(500) NULL,
        trangThai VARCHAR(20) NOT NULL
            CONSTRAINT chk_DonationEvents_trangThai CHECK (
                trangThai IN ('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED')
            )
            DEFAULT 'UPCOMING',
        createdAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT uniq_DonationEvents_maSuKien UNIQUE (maSuKien)
    );
    CREATE INDEX idx_DonationEvents_ngayToChuc_trangThai
        ON dbo.DonationEvents(ngayToChuc, trangThai);
END;
GO

-- 7. DonorCheckIns
IF OBJECT_ID(N'dbo.DonorCheckIns', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DonorCheckIns (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_DonorCheckIns PRIMARY KEY DEFAULT NEWID(),
        eventId UNIQUEIDENTIFIER NOT NULL,
        donorId UNIQUEIDENTIFIER NOT NULL,
        stt INT NOT NULL,
        clientRequestId UNIQUEIDENTIFIER NOT NULL,
        thoiGianCheckIn DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        luongMauDangKy INT NOT NULL
            CONSTRAINT chk_DonorCheckIns_luongMau CHECK (luongMauDangKy IN (250, 350, 450)),
        daDongYXuLyDuLieu BIT NOT NULL
            CONSTRAINT chk_DonorCheckIns_dongY CHECK (daDongYXuLyDuLieu = 1),
        khaiBaoSucKhoe NVARCHAR(1000) NOT NULL,
        buocHienTai VARCHAR(20) NOT NULL
            CONSTRAINT chk_DonorCheckIns_buoc CHECK (
                buocHienTai IN ('CHO_KHAM', 'CHO_XET_NGHIEM', 'CHO_LAY_MAU', 'HOAN_THANH', 'TAM_HOAN')
            )
            DEFAULT 'CHO_KHAM',
        lyDoTamHoan NVARCHAR(500) NULL,
        trackingToken VARCHAR(128) NOT NULL,
        updatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT uniq_DonorCheckIns_clientRequestId UNIQUE (clientRequestId),
        CONSTRAINT uniq_DonorCheckIns_event_donor UNIQUE (eventId, donorId),
        CONSTRAINT fk_DonorCheckIns_Events FOREIGN KEY (eventId) REFERENCES dbo.DonationEvents(id),
        CONSTRAINT fk_DonorCheckIns_Donors FOREIGN KEY (donorId) REFERENCES dbo.Donors(id)
    );
    CREATE INDEX idx_DonorCheckIns_eventId_buoc_stt
        ON dbo.DonorCheckIns(eventId, buocHienTai, stt);
END;
GO

-- 8. ClinicalExams
IF OBJECT_ID(N'dbo.ClinicalExams', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ClinicalExams (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_ClinicalExams PRIMARY KEY DEFAULT NEWID(),
        checkInId UNIQUEIDENTIFIER NOT NULL,
        bacSiId UNIQUEIDENTIFIER NOT NULL,
        huyetApTamThu INT NOT NULL,
        huyetApTamTruong INT NOT NULL,
        nhipTim INT NOT NULL,
        canNang DECIMAL(5, 2) NOT NULL,
        theTichDuocPhep INT NULL
            CONSTRAINT chk_ClinicalExams_theTich CHECK (
                theTichDuocPhep IS NULL OR theTichDuocPhep IN (250, 350, 450)
            ),
        ketLuan VARCHAR(20) NOT NULL
            CONSTRAINT chk_ClinicalExams_ketLuan CHECK (ketLuan IN ('DAT', 'TAM_HOAN')),
        lyDoTuChoi NVARCHAR(500) NULL,
        createdAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT uniq_ClinicalExams_checkInId UNIQUE (checkInId),
        CONSTRAINT fk_ClinicalExams_CheckIns FOREIGN KEY (checkInId) REFERENCES dbo.DonorCheckIns(id),
        CONSTRAINT fk_ClinicalExams_Users FOREIGN KEY (bacSiId) REFERENCES dbo.Users(id)
    );
END;
GO

-- 9. ScreeningTests
IF OBJECT_ID(N'dbo.ScreeningTests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ScreeningTests (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_ScreeningTests PRIMARY KEY DEFAULT NEWID(),
        checkInId UNIQUEIDENTIFIER NOT NULL,
        kyThuatVienId UNIQUEIDENTIFIER NOT NULL,
        hemoglobin DECIMAL(4, 1) NOT NULL,
        hbsagTest VARCHAR(15) NOT NULL
            CONSTRAINT chk_ScreeningTests_hbsag CHECK (hbsagTest IN ('AM_TINH', 'DUONG_TINH')),
        hcvTest VARCHAR(15) NOT NULL
            CONSTRAINT chk_ScreeningTests_hcv CHECK (hcvTest IN ('AM_TINH', 'DUONG_TINH')),
        hivTest VARCHAR(15) NOT NULL
            CONSTRAINT chk_ScreeningTests_hiv CHECK (hivTest IN ('AM_TINH', 'DUONG_TINH')),
        nhomMauSoBo VARCHAR(2) NOT NULL
            CONSTRAINT chk_ScreeningTests_nhomMau CHECK (nhomMauSoBo IN ('A', 'B', 'AB', 'O')),
        rhFactorSoBo CHAR(1) NOT NULL
            CONSTRAINT chk_ScreeningTests_rhFactor CHECK (rhFactorSoBo IN ('+', '-')),
        ketLuan VARCHAR(20) NOT NULL
            CONSTRAINT chk_ScreeningTests_ketLuan CHECK (ketLuan IN ('DAT', 'TAM_HOAN')),
        createdAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT uniq_ScreeningTests_checkInId UNIQUE (checkInId),
        CONSTRAINT fk_ScreeningTests_CheckIns FOREIGN KEY (checkInId) REFERENCES dbo.DonorCheckIns(id),
        CONSTRAINT fk_ScreeningTests_Users FOREIGN KEY (kyThuatVienId) REFERENCES dbo.Users(id)
    );
END;
GO

-- 10. BloodBags
IF OBJECT_ID(N'dbo.BloodBags', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.BloodBags (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_BloodBags PRIMARY KEY DEFAULT NEWID(),
        checkInId UNIQUEIDENTIFIER NOT NULL,
        maVachTuiMau VARCHAR(30) NOT NULL,
        qrCode NVARCHAR(200) NOT NULL,
        nhomMau VARCHAR(2) NOT NULL
            CONSTRAINT chk_BloodBags_nhomMau CHECK (nhomMau IN ('A', 'B', 'AB', 'O')),
        rhFactor CHAR(1) NOT NULL
            CONSTRAINT chk_BloodBags_rhFactor CHECK (rhFactor IN ('+', '-')),
        theTich INT NOT NULL CONSTRAINT chk_BloodBags_theTich CHECK (theTich IN (250, 350, 450)),
        ngayLayMau DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        ngayHetHan DATETIME2(3) NOT NULL,
        trangThai VARCHAR(25) NOT NULL
            CONSTRAINT chk_BloodBags_trangThai CHECK (
                trangThai IN (
                    'QUARANTINE',
                    'IN_STOCK',
                    'IN_TRANSIT',
                    'HOSPITAL_RECEIVED',
                    'DISCARDED',
                    'EXPIRED'
                )
            )
            DEFAULT 'QUARANTINE',
        destinationHospitalId UNIQUEIDENTIFIER NULL,
        ketQuaSangLoc VARCHAR(20) NULL
            CONSTRAINT chk_BloodBags_ketQuaSangLoc CHECK (
                ketQuaSangLoc IS NULL OR ketQuaSangLoc IN ('DAT', 'KHONG_DAT')
            ),
        viTriKhoLanh NVARCHAR(100) NULL,
        createdAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT uniq_BloodBags_maVachTuiMau UNIQUE (maVachTuiMau),
        CONSTRAINT uniq_BloodBags_checkInId UNIQUE (checkInId),
        CONSTRAINT fk_BloodBags_CheckIns FOREIGN KEY (checkInId) REFERENCES dbo.DonorCheckIns(id),
        CONSTRAINT fk_BloodBags_Hospitals FOREIGN KEY (destinationHospitalId) REFERENCES dbo.Hospitals(id)
    );
    CREATE INDEX idx_BloodBags_trangThai_ngayHetHan
        ON dbo.BloodBags(trangThai, ngayHetHan)
        INCLUDE (nhomMau, rhFactor, theTich, maVachTuiMau);
    CREATE INDEX idx_BloodBags_destinationHospitalId
        ON dbo.BloodBags(destinationHospitalId) WHERE destinationHospitalId IS NOT NULL;
END;
GO

-- 11. DonationHistory (Nguon su that duy nhat cho luat 84 ngay)
IF OBJECT_ID(N'dbo.DonationHistory', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DonationHistory (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_DonationHistory PRIMARY KEY DEFAULT NEWID(),
        donorId UNIQUEIDENTIFIER NOT NULL,
        checkInId UNIQUEIDENTIFIER NOT NULL,
        bloodBagId UNIQUEIDENTIFIER NOT NULL,
        ngayHien DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        theTich INT NOT NULL,
        trangThai VARCHAR(20) NOT NULL
            CONSTRAINT chk_DonationHistory_trangThai CHECK (
                trangThai IN ('HOAN_THANH', 'HUY')
            )
            DEFAULT 'HOAN_THANH',
        createdAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT uniq_DonationHistory_checkInId UNIQUE (checkInId),
        CONSTRAINT fk_DonationHistory_Donors FOREIGN KEY (donorId) REFERENCES dbo.Donors(id),
        CONSTRAINT fk_DonationHistory_CheckIns FOREIGN KEY (checkInId) REFERENCES dbo.DonorCheckIns(id),
        CONSTRAINT fk_DonationHistory_BloodBags FOREIGN KEY (bloodBagId) REFERENCES dbo.BloodBags(id)
    );
    CREATE INDEX idx_DonationHistory_donorId_ngayHien
        ON dbo.DonationHistory(donorId, ngayHien DESC);
END;
GO

-- 12. EmergencyRequests
IF OBJECT_ID(N'dbo.EmergencyRequests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EmergencyRequests (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_EmergencyRequests PRIMARY KEY DEFAULT NEWID(),
        hospitalId UNIQUEIDENTIFIER NOT NULL,
        bacSiYeuCauId UNIQUEIDENTIFIER NOT NULL,
        maBenhAn NVARCHAR(50) NOT NULL,
        nhomMauCan VARCHAR(2) NOT NULL
            CONSTRAINT chk_EmergencyRequests_nhomMau CHECK (nhomMauCan IN ('A', 'B', 'AB', 'O')),
        rhFactor CHAR(1) NOT NULL
            CONSTRAINT chk_EmergencyRequests_rhFactor CHECK (rhFactor IN ('+', '-')),
        soLuongTui INT NOT NULL CONSTRAINT chk_EmergencyRequests_soLuong CHECK (soLuongTui > 0),
        mucDoKhan VARCHAR(20) NOT NULL
            CONSTRAINT chk_EmergencyRequests_mucDo CHECK (mucDoKhan IN ('NGUY_CAP', 'RAT_KHAN')),
        trangThaiXuLy VARCHAR(25) NOT NULL
            CONSTRAINT chk_EmergencyRequests_trangThai CHECK (
                trangThaiXuLy IN ('PENDING', 'ACKNOWLEDGED', 'DISPATCHED', 'COMPLETED', 'CANCELLED')
            )
            DEFAULT 'PENDING',
        thoiGianXacNhan DATETIME2(3) NULL,
        nguoiXacNhanId UNIQUEIDENTIFIER NULL,
        createdAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_EmergencyRequests_Hospitals FOREIGN KEY (hospitalId) REFERENCES dbo.Hospitals(id),
        CONSTRAINT fk_EmergencyRequests_Requester FOREIGN KEY (bacSiYeuCauId) REFERENCES dbo.Users(id),
        CONSTRAINT fk_EmergencyRequests_Acknowledger FOREIGN KEY (nguoiXacNhanId) REFERENCES dbo.Users(id)
    );
    CREATE INDEX idx_EmergencyRequests_trangThai_createdAt
        ON dbo.EmergencyRequests(trangThaiXuLy, createdAt DESC);
END;
GO

-- 13. HospitalDispatches
IF OBJECT_ID(N'dbo.HospitalDispatches', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.HospitalDispatches (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_HospitalDispatches PRIMARY KEY DEFAULT NEWID(),
        hospitalId UNIQUEIDENTIFIER NOT NULL,
        emergencyRequestId UNIQUEIDENTIFIER NULL,
        bienSoXe NVARCHAR(20) NOT NULL,
        taiXeHotline VARCHAR(15) NOT NULL,
        thoiGianXuatKho DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        trangThaiGiao VARCHAR(20) NOT NULL
            CONSTRAINT chk_HospitalDispatches_trangThai CHECK (
                trangThaiGiao IN ('IN_TRANSIT', 'PARTIAL_RECEIVED', 'DELIVERED')
            )
            DEFAULT 'IN_TRANSIT',
        dispatchedBy UNIQUEIDENTIFIER NOT NULL,
        createdAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_HospitalDispatches_Hospitals FOREIGN KEY (hospitalId) REFERENCES dbo.Hospitals(id),
        CONSTRAINT fk_HospitalDispatches_Emergency FOREIGN KEY (emergencyRequestId) REFERENCES dbo.EmergencyRequests(id),
        CONSTRAINT fk_HospitalDispatches_Users FOREIGN KEY (dispatchedBy) REFERENCES dbo.Users(id)
    );
END;
GO

-- 14. HospitalDispatchBags
IF OBJECT_ID(N'dbo.HospitalDispatchBags', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.HospitalDispatchBags (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_HospitalDispatchBags PRIMARY KEY DEFAULT NEWID(),
        dispatchId UNIQUEIDENTIFIER NOT NULL,
        bagId UNIQUEIDENTIFIER NOT NULL,
        thoiGianTiepNhan DATETIME2(3) NULL,
        nhanVienNhanId UNIQUEIDENTIFIER NULL,
        nhietDoGhiNhan DECIMAL(4, 1) NULL,
        CONSTRAINT uniq_HospitalDispatchBags_dispatch_bag UNIQUE (dispatchId, bagId),
        CONSTRAINT fk_HospitalDispatchBags_Dispatches FOREIGN KEY (dispatchId) REFERENCES dbo.HospitalDispatches(id),
        CONSTRAINT fk_HospitalDispatchBags_BloodBags FOREIGN KEY (bagId) REFERENCES dbo.BloodBags(id),
        CONSTRAINT fk_HospitalDispatchBags_Users FOREIGN KEY (nhanVienNhanId) REFERENCES dbo.Users(id)
    );
    CREATE INDEX idx_HospitalDispatchBags_bagId ON dbo.HospitalDispatchBags(bagId);
END;
GO

-- 15. AuditLogs (Bat bien - chi INSERT, co chuoi hash phat hien sua/xoa)
IF OBJECT_ID(N'dbo.AuditLogs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AuditLogs (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_AuditLogs PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
        userId UNIQUEIDENTIFIER NULL,
        hanhDong VARCHAR(60) NOT NULL,
        chiTiet NVARCHAR(2000) NOT NULL,
        diaChiIP VARCHAR(45) NULL,
        thoiGianTao DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
        hashTruoc CHAR(64) NOT NULL,
        hash CHAR(64) NOT NULL
    );
    CREATE INDEX idx_AuditLogs_thoiGianTao ON dbo.AuditLogs(thoiGianTao DESC);
END;
GO

-- View tong hop ton kho kha dung (chi tinh IN_STOCK va con han)
CREATE OR ALTER VIEW dbo.vw_BloodInventorySummary
AS
SELECT
    nhomMau,
    rhFactor,
    COUNT(*) AS soLuongTui,
    SUM(theTich) AS tongTheTichMl,
    MIN(ngayHetHan) AS hanDungGanNhat
FROM dbo.BloodBags
WHERE trangThai = 'IN_STOCK'
  AND ngayHetHan > SYSUTCDATETIME()
GROUP BY nhomMau, rhFactor;
GO
