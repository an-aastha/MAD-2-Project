from celery import shared_task
from .models import Account, Booking, PermissionGroup 
from .utils import format_report
from .mail import send_email
import datetime
import csv


@shared_task(ignore_results=False, name="download_reservations_csv")
def download_reservations_csv():
    booking_records = Booking.query.all() 
    filename = f"booking_records_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    filepath = f'static/{filename}'
    with open(filepath, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow([
            "Username", "Email", "Facility Name", "Vehicle Number",
            "Slot Label", "Entry Time", "Exit Time", "Cost"
        ])
        for record in booking_records:
            patron = record.account_owner if record.account_owner else None
            writer.writerow([
                patron.display_name if patron else "N/A",
                patron.mail if patron else "N/A",
                record.facility_snapshot,
                record.reg_number_snapshot,
                record.slot_snapshot,
                record.start_time.strftime('%d-%m-%Y %I:%M %p'),
                record.end_time.strftime('%d-%m-%Y %I:%M %p') if record.end_time else "Not Released",
                record.cost_charged if record.cost_charged else "Pending"
            ])
    return filename


@shared_task(ignore_results=False, name="monthly_reservation_report")
def monthly_reservation_report():
    users_to_report = [u for u in Account.query.all() if "admin" not in [r.name for r in u.roles]]
    
    for user_account in users_to_report:
        user_data = {
            "username": user_account.display_name,
            "reservations": []
        }
        for record in user_account.bookings:
            user_data["reservations"].append({
                "facility": record.facility_snapshot,
                "vehicle": record.reg_number_snapshot,
                "slot": record.slot_snapshot,
                "booked_at": record.start_time.strftime("%d-%m-%Y %I:%M %p"),
                "released_at": record.end_time.strftime("%d-%m-%Y %I:%M %p") if record.end_time else "Not Released",
                "cost": record.cost_charged if record.cost_charged else "Pending"
            })
        html_message = format_report("templates/mail_details.html", user_data)
        send_email(
            user_account.mail,
            subject="Monthly Parking Report",
            message=html_message,
            content="html"
        )
    return "Monthly reservation reports sent."


@shared_task(ignore_results=True, name="daily_reminder")
def daily_reminder():
    now = datetime.datetime.utcnow()
    inactive_since = now - datetime.timedelta(days=2)
    users_to_remind = [u for u in Account.query.all() if "admin" not in [r.name for r in u.roles]]
    for user_account in users_to_remind:
        recent = Booking.query.filter(
            Booking.account_id == user_account.account_id,
            Booking.start_time >= inactive_since
        ).first()
        if not recent:
            message = f"""Hi {user_account.display_name},

We noticed that you haven’t reserved a parking slot in the last couple of days.
If you plan to visit the premises soon, don’t forget to book your preferred parking spot in advance to avoid last-minute hassle. It only takes a few seconds!
Login now and secure your spot at your convenience.

Best regards,
Vehicle Parking App Team
"""
            send_email(
                user_account.mail,
                subject="Daily Parking Reminder",
                message=message,
                content="plain"
            )

    return "Simple daily reminders sent."