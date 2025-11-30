from .database import db
from flask_security import UserMixin, RoleMixin
from datetime import datetime


# ACCOUNT & ROLE MODELS

class Account(db.Model, UserMixin):
    __tablename__ = "accounts"
    account_id = db.Column(db.Integer, primary_key=True)
    mail = db.Column(db.String(120), unique=True, nullable=False)
    display_name = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    fs_uniquifier = db.Column(db.String, unique=True, nullable=False)
    active = db.Column(db.Boolean, nullable=False, default=True)

    roles = db.relationship("PermissionGroup", secondary="account_group_link", backref="members")
    bookings = db.relationship("Booking", backref="account_owner", cascade="all, delete")


class PermissionGroup(db.Model, RoleMixin):
    __tablename__ = "permission_groups"
    group_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(200))


class AccountGroupLink(db.Model):
    __tablename__ = "account_group_link"
    link_id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.account_id"))
    group_id = db.Column(db.Integer, db.ForeignKey("permission_groups.group_id"))


# FACILITY (PARKING AREA) MODELS

class Facility(db.Model):
    __tablename__ = "facilities"
    facility_id = db.Column(db.Integer, primary_key=True)
    place_label = db.Column(db.String(120), nullable=False)
    hourly_rate = db.Column(db.Float, nullable=False)
    zipcode = db.Column(db.String(12), nullable=False)
    total_slots = db.Column(db.Integer, nullable=False)

    slot_list = db.relationship("Slot", backref="facility_ref", lazy=True, cascade="all, delete")


# SLOT (PARKING SPACE) MODELS

class Slot(db.Model):
    __tablename__ = "slots"
    slot_id = db.Column(db.Integer, primary_key=True)
    facility_id = db.Column(db.Integer, db.ForeignKey("facilities.facility_id"), nullable=False)
    slot_state = db.Column(db.String(1), default="A")
    assigned_user = db.Column(db.Integer)
    reg_number = db.Column(db.String(20))
    slot_label = db.Column(db.String(20))

    booking_records = db.relationship("Booking", backref="slot_ref", lazy=True)


# BOOKING MODELS

class Booking(db.Model):
    __tablename__ = "bookings"
    booking_id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.account_id"), nullable=False)
    slot_id = db.Column(db.Integer, db.ForeignKey("slots.slot_id"), nullable=True)
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    facility_snapshot = db.Column(db.String(120))
    slot_snapshot = db.Column(db.String(20))
    cost_charged = db.Column(db.Float, default=0.0)
    reg_number_snapshot = db.Column(db.String(20), nullable=False)
