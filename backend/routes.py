from .database import db
from .models import Account, PermissionGroup, Slot, Facility, Booking
from flask import current_app as app, jsonify, request, render_template, send_from_directory, redirect
from flask_security import auth_required, roles_required, roles_accepted, current_user, login_user
from werkzeug.security import check_password_hash, generate_password_hash
from backend.tasks import download_reservations_csv, monthly_reservation_report
from datetime import datetime, timedelta
from math import ceil
from celery.result import AsyncResult
import os


# ---------------- ROOT ---------------- #
@app.route("/", methods=["GET"])
def root_page():
    return render_template("index.html")


# ---------------- AUTH ---------------- #
@app.route("/auth/login", methods=["POST"])
def login_action():
    info = request.get_json() or {}
    email = info.get("email")
    password = info.get("password")
    if not email:
        return jsonify({"message": "Email is required!"}), 400
    user = app.security.datastore.find_user(mail=email)
    if not user:
        return jsonify({"message": "Account not found"}), 404
    if not check_password_hash(user.password_hash, password):
        return jsonify({"message": "Incorrect password"}), 400

    login_user(user)
    return jsonify({
        "id": user.account_id,
        "username": user.display_name,
        "roles": [r.name for r in user.roles],
        "auth_token": user.get_auth_token()
    })


@app.route("/auth/register", methods=["POST"])
def register_action():
    details = request.get_json() or {}
    if app.security.datastore.find_user(mail=details.get("email")):
        return jsonify({"message": "Account already exists", "success": False}), 400
    app.security.datastore.create_user(
        mail=details.get("email"),
        display_name=details.get("username"),
        password_hash=generate_password_hash(details.get("password")),
        roles=["user"]
    )
    db.session.commit()
    return jsonify({"message": "Account created", "success": True}), 201


# ---------------- PROFILE / ADMIN HOMES ---------------- #
@app.route("/admin/home")
@auth_required("token")
@roles_required("admin")
def admin_dashboard_info():
    return jsonify({"message": "Admin access confirmed"}), 200


@app.route("/user/profile")
@auth_required("token")
@roles_accepted("user", "admin")
def profile_info():
    acc = current_user
    return jsonify({
        "username": acc.display_name,
        "email": acc.mail,
        "roles": [r.name for r in acc.roles]
    }), 200


# ---------------- BOOKING ---------------- #
@app.route("/booking/reserve", methods=["POST"])
@auth_required("token")
@roles_accepted("user", "admin")
def reserve_slot():
    try:
        data = request.get_json() or {}
        facility_id = data.get("facility_id")
        reg_no = data.get("vehicle_no")
        if not facility_id or not reg_no:
            return jsonify({"message": "facility_id and vehicle_no are required"}), 400
        slot = Slot.query.filter_by(facility_id=facility_id, slot_state="A").first()
        if not slot:
            return jsonify({"message": "No free slots available"}), 400
        slot.slot_state = "O"
        slot.assigned_user = current_user.account_id
        slot.reg_number = reg_no
        db.session.commit()
        booking = Booking(
            account_id=current_user.account_id,
            slot_id=slot.slot_id,
            reg_number_snapshot=reg_no,
            facility_snapshot=slot.facility_ref.place_label,
            slot_snapshot=slot.slot_label,
            start_time=datetime.utcnow()
        )
        db.session.add(booking)
        db.session.commit()
        app.cache.delete("facility_data_listing")
        return jsonify({"message": "Slot reserved successfully!"}), 200
    except Exception as e:
        print(f"Reserve Slot Error: {e}")
        return jsonify({"message": "Booking failed due to a server error."}), 500


# ------------------ HISTORY ------------------ #

@app.route("/booking/history")
@auth_required("token")
@roles_accepted("user", "admin")
def history_view():
    try:
        records = Booking.query.filter_by(account_id=current_user.account_id).order_by(Booking.booking_id.desc()).all()
        result = []
        for b in records:
            associated_slot = b.slot_ref
            facility = associated_slot.facility_ref if associated_slot else None
            result.append({
                "id": b.booking_id, 
                "slot_id_to_release": b.slot_id,
                "facility": facility.place_label if facility else b.facility_snapshot,
                "slot": associated_slot.slot_label if associated_slot else b.slot_snapshot,
                "vehicle": b.reg_number_snapshot, 
                "start": (b.start_time + timedelta(hours=5, minutes=30)).isoformat(), 
                "end": (b.end_time + timedelta(hours=5, minutes=30)).isoformat() if b.end_time else None, 
                "released": bool(b.end_time),
                "rate": facility.hourly_rate if facility else "N/A"
            })
        return jsonify(result), 200
    except Exception as e:
        print(f"History View Error: {e}")
        return jsonify({"message": "Error retrieving history."}), 500



# ------------------ RELEASE ------------------ #
@app.route("/booking/release", methods=["POST"])
@auth_required("token")
@roles_accepted("user", "admin")
def release_action():
    try:
        info = request.get_json() or {}
        slot_pk_id = info.get("slot_id")
        slot = Slot.query.get(slot_pk_id)
        if not slot:
            return jsonify({"message": "Invalid slot ID"}), 404
        booking = Booking.query.filter_by(slot_id=slot.slot_id, account_id=current_user.account_id, end_time=None)\
            .order_by(Booking.booking_id.desc()).first()
        if not booking:
            return jsonify({"message": "No active booking found for this spot/user"}), 400
        booking.end_time = datetime.utcnow()
        hours_used = ceil((booking.end_time - booking.start_time).total_seconds() / 3600)
        booking.cost_charged = round(max(hours_used, 1) * slot.facility_ref.hourly_rate, 2)
        slot.slot_state = "A"
        slot.assigned_user = None
        slot.reg_number = None
        db.session.commit()
        app.cache.delete("facility_data_listing")
        return jsonify({"message": f"Spot released. Charged ₹{booking.cost_charged}"}), 200
    except Exception as e:
        print(f"Release Action Error: {e}")
        return jsonify({"message": "Error processing release."}), 500


# ---------------- ADMIN REPORTS ---------------- #
@app.route("/admin/export-csv")
@auth_required("token")
@roles_required("admin")
def queue_csv_export():
    task = download_reservations_csv.delay()
    return jsonify({"job_id": task.id}), 202


@app.route("/admin/export-result/<job_id>")
@auth_required("token")
@roles_required("admin")
def csv_result(job_id):
    result = AsyncResult(job_id)
    if not result.ready():
        return jsonify({"status": "processing", "message": "File is being generated"}), 202
    if result.failed():
        return jsonify({"status": "failed", "message": "Task failed"}), 500
    filename = result.result
    if not filename:
        return jsonify({"status": "error", "message": "No file produced"}), 500
    try:
        return send_from_directory("static", filename, as_attachment=True)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/admin/send-monthly-report")
@auth_required("token")
@roles_required("admin")
def trigger_monthly_report():
    task = monthly_reservation_report.delay()
    return jsonify({"status": "queued", "task": task.id}), 202


# 1. Facility Occupancy Stats
@app.route('/api/admin/lot-stats')
@auth_required('token')
@roles_required('admin')
def get_lot_occupancy_stats():
    try:
        facilities = Facility.query.all()
        result = []
        for fac in facilities:
            occupied = Slot.query.filter_by(facility_id=fac.facility_id, slot_state='O').count()
            available = Slot.query.filter_by(facility_id=fac.facility_id, slot_state='A').count()
            result.append({
                "location_name": fac.place_label,
                "occupied_spots": occupied,
                "available_spots": available
            })
        return jsonify(result), 200
    except Exception as e:
        print(f"Occupancy Stats Error: {e}")
        return jsonify({"error": "Failed to fetch occupancy stats"}), 500


# 2. Revenue per Facility
@app.route('/api/admin/revenue-per-lot')
@auth_required('token')
@roles_required('admin')
def get_revenue_per_lot():
    try:
        rows = db.session.query(
            Facility.place_label,
            db.func.sum(Booking.cost_charged)
        ).join(Slot, Slot.facility_id == Facility.facility_id
        ).join(Booking, Booking.slot_id == Slot.slot_id
        ).group_by(Facility.facility_id).all()
        data = [{"location_name": r[0], "revenue": round(r[1] or 0, 2)} for r in rows]
        return jsonify(data), 200
    except Exception as e:
        print(f"Revenue Stats Error: {e}")
        return jsonify({"error": "Failed to fetch revenue stats"}), 500


# ---------------- FRONTEND BRIDGE ROUTES ---------------- #

@app.route("/api/lot", methods=["GET", "POST"])
def bridge_lot_root():
    return redirect("/catalog/facility", code=307)

@app.route("/api/lot/<int:facility_id>", methods=["PUT", "DELETE"])
def bridge_lot_edit(facility_id):
    return redirect(f"/catalog/facility/{facility_id}", code=307)

@app.route("/api/spot/<int:facility_id>/<int:position>", methods=["GET", "DELETE"])
def bridge_spot(facility_id, position):
    return redirect(f"/catalog/slot/{facility_id}/{position}", code=307)

@app.route("/api/users", methods=["GET"])
def bridge_users():
    return redirect("/admin/accounts", code=307)

@app.route("/api/export", methods=["GET"])
def bridge_export():
    return redirect("/admin/export-csv", code=307)

@app.route("/api/csv_result/<job_id>", methods=["GET"])
def bridge_csv_result(job_id):
    return redirect(f"/admin/export-result/{job_id}", code=307)
