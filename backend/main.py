from fastapi import FastAPI
from pydantic import BaseModel

# Initialize the FastAPI application
app = FastAPI(
    title="FastAPI Server",
    description="A basic FastAPI server",
    version="1.0.0"
)


# Example Pydantic model for request/response validation
class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    quantity: int = 1


# Root endpoint
@app.get("/")
async def root():
    """Welcome endpoint"""
    return {"message": "Welcome to FastAPI!", "status": "running"}


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


# Example GET endpoint with path parameter
@app.get("/items/{item_id}")
async def get_item(item_id: int):
    """Get an item by ID"""
    return {"item_id": item_id, "name": f"Item {item_id}"}


# Example POST endpoint with request body
@app.post("/items")
async def create_item(item: Item):
    """Create a new item"""
    return {"message": "Item created successfully", "item": item}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
