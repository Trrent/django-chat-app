from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
import json

from .models import Room, Message


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if self.scope['user'] is None or not self.scope['user'].is_authenticated:
            await self.close()
            return
        
        self.user = self.scope['user']
        self.nickname = await self._get_user_nickname(self.user)
        
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f"chat_{self.room_id}"        
        self.room, _ = await database_sync_to_async(Room.objects.get_or_create)(id=self.room_id)
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        
        # text = f"{self.user.username} вошёл в чат"
        # msg = await database_sync_to_async(Message.objects.create)(room=self.room, user=None, text=text, type=Message.INFO)
        
        # await self.channel_layer.group_send(
        #         self.room_name,
        #         {
        #             "type": "chat.info",
        #             "message": f"User {self.nickname} has joined the chat."
        #         }
        #     )        
        
        messages = await self.get_last_messages(100)
        for msg in messages[::-1]:
            serialized = await self.serialize_message(msg)
            await self.chat_message(serialized)
            
    @database_sync_to_async
    def serialize_message(self, msg):
        return {
            'message': msg.text,
            'nickname': msg.user.username if msg.user else None,
            'timestamp': msg.timestamp.strftime('%H:%M:%S'),
            'msg_type': msg.type,
        }
            
    @database_sync_to_async
    def _get_user_nickname(self, user):
        return user.profile.nickname or user.username
            
    @database_sync_to_async
    def get_last_messages(self, count):
        room_obj, _ = Room.objects.get_or_create(id=self.room_id)
        return list(room_obj.messages.all().order_by('-timestamp')[:count])
            
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        
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
            room=self.room,
            user=self.user,
            text=message,
            type=Message.CHAT
        )
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat.message",
                "message": message,
                "nickname": self.user.username,
                "timestamp": timezone.now().strftime('%H:%M:%S'),
                "msg_type": Message.CHAT,
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
                    'message': event['message'],
                    'nickname': event['nickname'],
                    'timestamp': event['timestamp'],
                    'msg_type': event['msg_type'],
                    }))
          
    async def chat_info(self, event):
        self.send(text_data=json.dumps({
                    'message': event['message'],
                    'timestamp': event['timestamp'],
                    'msg_type': event['msg_type'],
                    }))