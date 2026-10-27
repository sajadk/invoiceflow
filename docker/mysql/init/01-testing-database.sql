-- Runs automatically the first time the MySQL volume is created.
-- For an existing volume run: make test-db
CREATE DATABASE IF NOT EXISTS invoiceflow_testing;
GRANT ALL PRIVILEGES ON invoiceflow_testing.* TO 'invoiceflow'@'%';
FLUSH PRIVILEGES;
