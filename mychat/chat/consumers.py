from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from urllib.parse import parse_qs
from django.utils import timezone
import json

from .models import Room, Message


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        qs = parse_qs(self.scope['query_string'].decode())
        self.nickname = qs.get('nickname', ['Anonymous'])[0]
        self.room_name = qs.get('room', ['global'])[0]
        
        self.room = await database_sync_to_async(Room.objects.get_or_create)(name=self.room_name)
        
        await self.channel_layer.group_add(self.room_name, self.channel_name)
        await self.accept()
        
        # await self.channel_layer.group_send(
        #         self.room_name,
        #         {
        #             "type": "chat.info",
        #             "message": f"User {self.nickname} has joined the chat."
        #         }
        #     )        
        
        messages = await self.get_last_messages(100)
        for msg in messages[::-1]:
            await self.chat_message({
                'message': msg.text,
                'nickname': msg.nickname,
                'timestamp': msg.timestamp.strftime('%H:%M:%S'),
            })
            
    @database_sync_to_async
    def get_last_messages(self, count):
        room_obj, _ = Room.objects.get_or_create(name=self.room_name)
        return list(room_obj.messages.all().order_by('-timestamp')[:count])
            
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_name, self.channel_name)
        
        # await self.channel_layer.group_send(
        #     self.room_name,
        #     {
        #         "type": "chat.message",
        #         "message": f"User {self.channel_name} has left the chat."
        #     }
        # )

    async def receive(self, text_data=None, bytes_data=None):
        data = json.loads(text_data)
        message = data.get('message', '')
        
        await database_sync_to_async(Message.objects.create)(
            room=self.room[0],
            nickname=self.nickname,
            text=message
        )
        
        await self.channel_layer.group_send(
            self.room_name,
            {
                "type": "chat.message",
                "message": f"{message}",
                "nickname": self.nickname,
                "timestamp": timezone.now().strftime('%H:%M:%S')
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=f"[{event['timestamp']}] {event['nickname']}: {event['message']}")
        
    async def chat_info(self, event):
        await self.send(text_data=event['message'])