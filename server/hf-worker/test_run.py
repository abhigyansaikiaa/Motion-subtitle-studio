import asyncio
import os
from app import process_job

async def main():
    await process_job("e258c9e6-a651-403d-a8e4-9de36787fcb9")

if __name__ == "__main__":
    asyncio.run(main())
