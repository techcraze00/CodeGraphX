"""FastAPI backend with a parameterized route, matched cross-language by getUser."""
from fastapi import FastAPI

app = FastAPI()


@app.get('/api/users/{user_id}')
def read_user(user_id):
    return {"id": user_id}
