# Vehical_Parking_Mad-2

1. Create vertual environment  -------- python3 -m venv .env

2. Activate virtual environment  ------ source .env/bin/activate

3. Create requirements.txt  -------  pip freeze > requirements.txt

4. Install packages form requirements.txt  ------ pip install -r requirements.txt

5. Flask server  -------  Python3 app.py

6. Redis server  -------  redis-server

7. Celery worker  ------  .env/bin/celery -A app.celery worker --loglevel INFO

8. Celery beat  --------  .env/bin/celery -A app.celery beat --loglevel INFO




9. Stop redis server  ------  ps aux | grep redis     ---------> then --------> sudo kill "number given by previous command"


10. sudo pkill redis-server
11. p kill -f "celery worker"
12. p kill -f "celery beat"


13. sudo systemctl stop redis
14. sudo systemctl disable redis



#### If vertual environment (.env) file deleted then it to deactivate command is --------------->    source ~/.bashrc
