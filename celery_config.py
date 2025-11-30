from celery.schedules import crontab

broker_url = "redis://localhost:6379/0"
result_backend = "redis://localhost:6379/1"
timezone = "Asia/Kolkata"
broker_connection_retry_on_startup = True

beat_schedule = {
    'send-daily-reminders': {
        'task': 'daily_reminder',
        'schedule': crontab(minute='*/1'),
    },
    'send-monthly-reports': {
        'task': 'monthly_reservation_report',
        'schedule': crontab(minute='*/2'),
    }
}


#  for month (day_of_month=1, hour=10, minute=0)

#  for daily (hour=12, minute=0)

#  for minute (minute='*/1')

#  http://localhost:5000/api/mail

#  redis ---> redis-server
#  celery --> celery -A app.celery worker --loglevel INFO
#  beat  ---> celery -A app.celery beat --loglevel INFO
#  mailhog -> http://localhost:8025 -----> ./MailHog