-- ============================================================================
-- SMARTBLOOD - TAI KHOAN UNG DUNG PHAN QUYEN TOI THIEU (LEAST PRIVILEGE)
-- AuditLogs chi cap quyen INSERT, khong cap UPDATE/DELETE
-- Thao tac ghi qua Stored Procedure (EXECUTE)
-- ============================================================================

USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'hienmau_app')
BEGIN
    CREATE LOGIN hienmau_app WITH PASSWORD = N'ChangeThisStrongAppPass!2026', CHECK_POLICY = ON;
END;
GO

USE HienMauDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'hienmau_app')
BEGIN
    CREATE USER hienmau_app FOR LOGIN hienmau_app;
END;
GO

-- Cho phep thuc thi tat ca Stored Procedures trong schema dbo
GRANT EXECUTE ON SCHEMA::dbo TO hienmau_app;
-- Cho phep SELECT de phuc vu truy van danh sach DataTable & view
GRANT SELECT ON SCHEMA::dbo TO hienmau_app;
-- Chan moi thao tac UPDATE/DELETE truc tiep tren AuditLogs
DENY UPDATE, DELETE ON dbo.AuditLogs TO hienmau_app;
GRANT INSERT ON dbo.AuditLogs TO hienmau_app;
GO
