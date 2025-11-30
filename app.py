from flask import Flask
from backend.database import db
from backend.models import Account, PermissionGroup
from backend.resources import api
from backend.config import LocalDevelopmentConfig
from flask_security import Security, SQLAlchemyUserDatastore
from werkzeug.security import generate_password_hash
from backend.celery_init import celery_init_app
from flask_caching import Cache


cache = Cache(config={
    'CACHE_TYPE': 'RedisCache',
    'CACHE_REDIS_HOST': 'localhost',
    'CACHE_REDIS_PORT': 6379,
    'CACHE_REDIS_DB': 0,
    'CACHE_DEFAULT_TIMEOUT': 300
})

def create_app():
    app = Flask(__name__)
    app.config.from_object(LocalDevelopmentConfig)

    db.init_app(app)
    api.init_app(app)

    cache.init_app(app) 
    app.cache = cache   

    datastore = SQLAlchemyUserDatastore(db, Account, PermissionGroup)
    app.security = Security(app, datastore)
    app.app_context().push()
    return app

app = create_app()
celery = celery_init_app(app)


with app.app_context():
    db.create_all()

    app.security.datastore.find_or_create_role(name="admin", description="System Administrator")
    app.security.datastore.find_or_create_role(name = "user", description = "General user of app")
    db.session.commit()

    if not app.security.datastore.find_user(mail="aastha@gmail.com"):
        app.security.datastore.create_user(mail="astha@gmail.com",
                                           display_name="Aastha",
                                           password_hash=generate_password_hash("aastha123"),
                                           roles=["admin"])
    db.session.commit()

from backend.routes import *

if __name__=="__main__":
    app.run()
