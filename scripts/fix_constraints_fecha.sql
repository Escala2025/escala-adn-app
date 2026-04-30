-- Elimina las restricciones de fecha futura que causan rechazo por diferencia de zona horaria.
-- La validación de fecha se hace en el frontend, no es necesaria en BD.

ALTER TABLE pagos_personal
  DROP CONSTRAINT IF EXISTS ck_pp_fecha_no_futura;

ALTER TABLE transacciones_proveedores
  DROP CONSTRAINT IF EXISTS ck_trx_fecha_no_futura;
