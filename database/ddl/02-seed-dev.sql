-- ============================================================================
-- SMARTBLOOD - DU LIEU MAU MOI TRUONG PHAT TRIEN (DEV SEED)
-- Mat khau mac dinh cho cac tai khoan dev: SmartBlood@2026
-- Luu y: Khong chay file nay tren production.
-- ============================================================================

USE HienMauDB;
GO

SET NOCOUNT ON;

-- 1. Benh vien doi tac tai Dong Nai
IF NOT EXISTS (SELECT 1 FROM dbo.Hospitals WHERE tenBenhVien = N'Bệnh viện Đa khoa Đồng Nai')
BEGIN
    INSERT INTO dbo.Hospitals (id, tenBenhVien, diaChi, hotlineCapCuu, toaDoLat, toaDoLng, trangThaiHopTac)
    VALUES
        ('11111111-1111-1111-1111-111111111101', N'Bệnh viện Đa khoa Đồng Nai', N'Số 2 Đồng Khởi, P. Tam Hòa, TP. Biên Hòa', '02513890115', 10.957410, 106.842680, 'ACTIVE'),
        ('11111111-1111-1111-1111-111111111102', N'Bệnh viện Đa khoa Thống Nhất', N'234 QL1A, P. Tân Biên, TP. Biên Hòa', '02513883115', 10.968200, 106.890120, 'ACTIVE');
END;
GO

-- 2. Tai khoan mau (matKhauHash bcrypt 10 rounds cho 'SmartBlood@2026')
DECLARE @DefaultHash VARCHAR(255) = '$2b$10$zeFCA6JX/ExL8OK7sx0FkOeIbQG2QcdXuxwOi6OI9E5JcIN2msjly';

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE email = N'admin@redcross-bienhoa.vn')
BEGIN
    INSERT INTO dbo.Users (id, email, matKhauHash, vaiTro, hospitalId, laNguoiPheDuyet, emailDaXacThuc, trangThai)
    VALUES
        ('22222222-2222-2222-2222-222222222201', N'admin@redcross-bienhoa.vn', @DefaultHash, 'ADMIN', NULL, 0, 1, 'ACTIVE'),
        ('22222222-2222-2222-2222-222222222202', N'director@redcross-bienhoa.vn', @DefaultHash, 'ADMIN', NULL, 1, 1, 'ACTIVE'),
        ('22222222-2222-2222-2222-222222222203', N'staff@redcross-bienhoa.vn', @DefaultHash, 'RED_CROSS_STAFF', NULL, 0, 1, 'ACTIVE'),
        ('22222222-2222-2222-2222-222222222204', N'doctor@bvdongnai.vn', @DefaultHash, 'HOSPITAL_STAFF', '11111111-1111-1111-1111-111111111101', 0, 1, 'ACTIVE'),
        ('22222222-2222-2222-2222-222222222205', N'doctor@bvthongnhat.vn', @DefaultHash, 'HOSPITAL_STAFF', '11111111-1111-1111-1111-111111111102', 0, 1, 'ACTIVE');
END;
GO
