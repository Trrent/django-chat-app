import asyncio
import websockets

users = set()

async def message_handler(websocket):
    users.add(websocket)
    
    nickname = await websocket.recv()
    for user in users:
        try:
            await user.send(f"{nickname} has joined the chat.")
        except websockets.ConnectionClosed:
            pass
    
    async for message in websocket:
        print('Received message:', message)
        for user in users:
            if user != websocket:
                try:
                    await user.send(f"[{nickname}]: {message}")
                except websockets.ConnectionClosed:
                    pass
    
    users.remove(websocket)


async def main():
    async with websockets.serve(message_handler, 'localhost', 8765) as server:
        print("Echo server is running on ws://localhost:8765")
        await asyncio.Future()

if __name__ == '__main__':
    asyncio.run(main())