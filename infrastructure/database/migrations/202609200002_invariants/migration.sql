ALTER TABLE "Service" ADD CONSTRAINT service_interval CHECK ("endsAt" > "startsAt");
ALTER TABLE "ServicePosition" ADD CONSTRAINT position_quantity CHECK (quantity BETWEEN 1 AND 1000);
ALTER TABLE "Invitation" ADD CONSTRAINT invitation_capacity CHECK (uses >= 0 AND "maxUses" > 0 AND uses <= "maxUses");
ALTER TABLE "User" ADD CONSTRAINT normalized_email CHECK (email = lower(trim(email)));
CREATE UNIQUE INDEX assignment_active_user_position ON "ServiceAssignment" ("servicePositionId", "userId") WHERE status IN ('AWAITING_CONFIRMATION', 'CONFIRMED');

-- The row lock serializes direct SQL writers as well as API transactions.
CREATE FUNCTION check_assignment_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE capacity integer; occupied integer;
BEGIN
  IF NEW.status IN ('AWAITING_CONFIRMATION', 'CONFIRMED') THEN
    SELECT quantity INTO capacity FROM "ServicePosition" WHERE id=NEW."servicePositionId" FOR UPDATE;
    SELECT count(*) INTO occupied FROM "ServiceAssignment"
      WHERE "servicePositionId"=NEW."servicePositionId" AND id<>NEW.id
        AND status IN ('AWAITING_CONFIRMATION', 'CONFIRMED');
    IF occupied >= capacity THEN RAISE EXCEPTION 'Position capacity exceeded' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assignment_capacity BEFORE INSERT OR UPDATE ON "ServiceAssignment" FOR EACH ROW EXECUTE FUNCTION check_assignment_capacity();

CREATE FUNCTION protect_position_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.quantity < (SELECT count(*) FROM "ServiceAssignment" WHERE "servicePositionId"=NEW.id AND status IN ('AWAITING_CONFIRMATION','CONFIRMED')) THEN
    RAISE EXCEPTION 'Position capacity below active assignments' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER position_capacity BEFORE UPDATE OF quantity ON "ServicePosition" FOR EACH ROW EXECUTE FUNCTION protect_position_capacity();
