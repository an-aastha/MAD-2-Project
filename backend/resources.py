from flask_restful import Api, Resource, reqparse
from flask_security import auth_required, roles_required, roles_accepted
from flask import current_app, jsonify
from .database import db
from .models import Account, PermissionGroup, Facility, Slot, Booking

api = Api()

## Request Parsers 
facility_parser = reqparse.RequestParser()
facility_parser.add_argument("place_label", required=True) 
facility_parser.add_argument("hourly_rate", type=float, required=True)
facility_parser.add_argument("zipcode", required=True)  
facility_parser.add_argument("total_slots", type=int, required=True)


# ------------------------------ FACILITY COLLECTION RESOURCE ------------------------------ #
class FacilityApi(Resource):
    @auth_required("token")
    @roles_accepted("admin", "user")
    def get(self):
        """
        Return all facilities with slot details (cached).
        """
        cache = current_app.cache
        cached = cache.get("facility_cache")
        if cached:
            return cached, 200
        facilities = Facility.query.all()
        result = []
        for fac in facilities:
            slots = Slot.query.filter_by(facility_id=fac.facility_id).order_by(Slot.slot_id).all()
            slot_list = [
                {
                    "number": idx + 1,
                    "status": s.slot_state,
                    "facilityId": fac.facility_id
                }
                for idx, s in enumerate(slots)
            ]
            result.append({
                "id": fac.facility_id,
                "place_label": fac.place_label,
                "hourly_rate": fac.hourly_rate,
                "zipcode": fac.zipcode,
                "total_slots": len(slots),
                "occupied_slots": sum(1 for s in slots if s.slot_state == "O"),
                "slots": slot_list
            })
        cache.set("facility_cache", result, timeout=300)
        return result, 200

    @auth_required("token")
    @roles_required("admin")
    def post(self):
        """
        Create a new facility and auto-generate slots.
        """
        data = facility_parser.parse_args()
        fac = Facility(
            place_label=data["place_label"],
            hourly_rate=data["hourly_rate"],
            zipcode=data["zipcode"],
            total_slots=data["total_slots"],
        )
        db.session.add(fac)
        db.session.commit()
        for i in range(data["total_slots"]):
            db.session.add(Slot(
                facility_id=fac.facility_id,
                slot_label=str(i + 1),
                slot_state="A"
            ))
        db.session.commit()
        current_app.cache.delete("facility_cache")
        return {"message": "Facility created successfully!"}, 201


# ------------------------------ FACILITY UPDATE / DELETE ------------------------------ #
class FacilityEditDeleteApi(Resource):
    @auth_required("token")
    @roles_required("admin")
    def put(self, facility_id):
        """
        Update facility info and adjust slot count.
        """
        data = facility_parser.parse_args()
        fac = Facility.query.get(facility_id)
        if not fac:
            return {"message": "Facility not found"}, 404
        fac.place_label = data.get("place_label") or fac.place_label
        fac.zipcode = data.get("zipcode") or fac.zipcode
        new_rate = data.get("hourly_rate")
        new_total = data.get("total_slots")
        if new_rate is not None:
            fac.hourly_rate = float(new_rate)
        if new_total is not None:
            current_count = Slot.query.filter_by(facility_id=fac.facility_id).count()
            diff = int(new_total) - current_count
            fac.total_slots = int(new_total)
            db.session.commit()
            if diff > 0:
                existing_labels = [int(s.slot_label) for s in Slot.query.filter_by(facility_id=fac.facility_id).all() if s.slot_label.isdigit()]
                start = max(existing_labels) if existing_labels else 0
                for i in range(diff):
                    db.session.add(Slot(
                        facility_id=fac.facility_id,
                        slot_label=str(start + i + 1),
                        slot_state="A",
                    ))
            elif diff < 0:
                to_remove = Slot.query.filter_by(facility_id=fac.facility_id, slot_state="A")\
                                      .order_by(Slot.slot_id).limit(abs(diff)).all()
                if len(to_remove) < abs(diff):
                    return {"message": "Can't reduce slots. Not enough available slots."}, 400
                for s in to_remove:
                    db.session.delete(s)
            db.session.commit()
            current_app.cache.delete("facility_cache")
        return {"message": "Facility updated successfully!"}, 200

    @auth_required("token")
    @roles_required("admin")
    def delete(self, facility_id):
        """
        Delete a facility if no slots are occupied.
        """
        fac = Facility.query.get(facility_id)
        if not fac:
            return {"message": "Facility not found"}, 404
        occupied = Slot.query.filter_by(facility_id=fac.facility_id, slot_state="O").count()
        if occupied > 0:
            return {"message": "Cannot delete. Some slots are still occupied."}, 400
        db.session.delete(fac)
        db.session.commit()
        current_app.cache.delete("facility_cache")
        return {"message": "Facility deleted successfully"}, 200

api.add_resource(FacilityApi, "/catalog/facility")
api.add_resource(FacilityEditDeleteApi, "/catalog/facility/<int:facility_id>")


# ------------------------------ SLOT DETAILS / DELETE ------------------------------ #
class SlotDetailsApi(Resource):
    @auth_required("token")
    @roles_required("admin")
    def get(self, facility_id, position):
        """
        Get slot details by position (1-based index).
        """
        slots = Slot.query.filter_by(facility_id=facility_id).order_by(Slot.slot_id).all()
        if not slots or position > len(slots) or position < 1:
            return {"message": "Slot not found"}, 404
        target = slots[position - 1]
        if target.slot_state != "O":
            return {"message": "Slot is not occupied"}, 400
        booking = Booking.query.filter_by(slot_id=target.slot_id).order_by(Booking.start_time.desc()).first()
        if not booking:
            return {"message": "No booking found"}, 404
        return {
            "slot_id": target.slot_id,
            "customer_id": booking.account_id,
            "vehicle_number": booking.reg_number_snapshot,
            "date": booking.start_time.strftime("%d/%m/%Y"),
            "time": booking.start_time.strftime("%I:%M:%S %p"),
            "cost": booking.cost_charged or 0.0
        }, 200

    @auth_required("token")
    @roles_required("admin")
    def delete(self, facility_id, position):
        """
        Delete an available slot by its index.
        """
        slots = Slot.query.filter_by(facility_id=facility_id).order_by(Slot.slot_id).all()
        if not slots or position > len(slots) or position < 1:
            return {"message": "Slot not found"}, 404
        target = slots[position - 1]
        if target.slot_state != "A":
            return {"message": "Cannot delete occupied slot"}, 400
        fac = Facility.query.get(facility_id)
        if fac:
            fac.total_slots = max(fac.total_slots - 1, 0)
        db.session.delete(target)
        db.session.commit()
        current_app.cache.delete("facility_cache")
        return {"message": "Slot deleted successfully"}, 200

api.add_resource(SlotDetailsApi, "/catalog/slot/<int:facility_id>/<int:position>")


# ------------------------------ ADMIN: USER LIST + SUMMARY ------------------------------ #
class AccountListApi(Resource):
    @auth_required("token")
    @roles_required("admin")
    def get(self):
        """
        List all non-admin users and their booking histories.
        """
        users = Account.query.filter(~Account.roles.any(PermissionGroup.name == "admin")).all()
        result = []
        for u in users:
            bookings = Booking.query.filter_by(account_id=u.account_id).order_by(Booking.booking_id.desc()).all()
            rows = []
            for b in bookings:
                fac = b.slot_ref.facility_ref if (b.slot_ref and b.slot_ref.facility_ref) else None
                rows.append({
                    "facility": fac.place_label if fac else b.facility_snapshot,
                    "slot": b.slot_ref.slot_label if b.slot_ref else b.slot_snapshot,
                    "vehicle": b.reg_number_snapshot,
                    "start": b.start_time.strftime('%d-%m-%Y %I:%M %p'),
                    "end": b.end_time.strftime('%d-%m-%Y %I:%M %p') if b.end_time else None,
                    "charged": b.cost_charged if b.cost_charged else "Pending"
                })
            result.append({
                "id": u.account_id,
                "username": u.display_name,
                "email": u.mail,
                "roles": [r.name for r in u.roles],
                "bookings": rows
            })
        return result, 200

api.add_resource(AccountListApi, "/admin/accounts")


# ------------------------------ ADMIN: SUMMARY & REVENUE REPORTS ------------------------------ #
class AdminSummary(Resource):
    @auth_required("token")
    @roles_required("admin")
    def get(self):
        total_users = Account.query.count()
        total_facilities = Facility.query.count()
        total_slots = Slot.query.count()
        total_revenue = db.session.query(
            db.func.sum(Booking.cost_charged)
        ).filter(Booking.cost_charged > 0).scalar() or 0.0
        return {
            "total_users": total_users,
            "total_lots": total_facilities,
            "total_spots": total_slots,
            "total_revenue": round(total_revenue, 2)
        }, 200

api.add_resource(AdminSummary, "/admin/summary")


class RevenuePerFacility(Resource):
    @auth_required("token")
    @roles_required("admin")
    def get(self):
        """
        Calculate total revenue per facility.
        """
        rows = db.session.query(
            Facility.place_label,
            db.func.sum(Booking.cost_charged)
        ).join(Slot, Slot.facility_id == Facility.facility_id
        ).join(Booking, Booking.slot_id == Slot.slot_id
        ).group_by(Facility.facility_id).all()
        data = [{"location_name": r[0], "revenue": round(r[1] or 0, 2)} for r in rows]
        return data, 200

api.add_resource(RevenuePerFacility, "/admin/revenue-per-facility")
