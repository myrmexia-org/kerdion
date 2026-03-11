-- İlk admin kullanıcısı (uygulama ilk kurulumunda)
-- Kullanıcı Adı: MyrmAdmin
-- Şifre: M@yrm06!Ank!
-- Giriş sonrası Kullanıcı Ayarları sayfasından değiştirilebilir.

INSERT INTO users (name, email, password_hash, mfa_secret, mfa_enabled)
VALUES (
    'MyrmAdmin',
    'myrmadmin@local',
    '$2b$12$e/fCz6HOlZVEO4MD6Eno8ejTNKk38H1WZ6HDZlVTK7KqhjPRAqw/S',
    NULL,
    FALSE
);
