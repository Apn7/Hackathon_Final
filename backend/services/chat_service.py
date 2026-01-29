"""
Chat Service with Rolling Summary Memory.
Implements intent detection, strict context management, and citation-based responses.
"""

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from supabase import Client
from langchain_google_genai import ChatGoogleGenerativeAI

from services.rag_service import RAGService


class ChatIntent:
    """User intent types for chat."""
    SEARCH = "search"           # User wants to find information
    SUMMARIZE = "summarize"     # User wants a summary
    EXPLAIN = "explain"         # User wants explanation/clarification
    FOLLOWUP = "followup"       # Follow-up on previous topic
    GENERATE_NOTES = "generate_notes"   # Generate study notes
    GENERATE_CODE = "generate_code"     # Generate code examples
    GENERAL = "general"         # General question


class ChatService:
    """
    Chat service with Rolling Summary Memory pattern.
    
    Features:
    - Intent detection (Search/Summarize/Explain/Followup)
    - Strict 5-message context window
    - Rolling summary for longer context
    - Citation-based responses with source attribution
    - "I Don't Know" rule to prevent hallucinations
    """
    
    CONTEXT_WINDOW = 5  # Last 5 messages only
    
    def __init__(self, supabase_client: Client, gemini_api_key: str, rag_service: RAGService):
        self.supabase = supabase_client
        self.rag_service = rag_service
        
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=gemini_api_key,
            temperature=0.2,  # Lower for more factual responses
        )
        
        self.summarizer = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=gemini_api_key,
            temperature=0.1,
        )
    
    def _detect_intent(self, message: str, has_history: bool) -> str:
        """
        Detect user intent from message.
        Returns: search, summarize, explain, followup, or general
        """
        message_lower = message.lower()
        
        # Check for summarize intent
        summarize_keywords = ['summarize', 'summary', 'overview', 'brief', 'key points', 'main ideas', 'tldr']
        if any(kw in message_lower for kw in summarize_keywords):
            return ChatIntent.SUMMARIZE
        
        # Check for explain/clarify intent
        explain_keywords = ['explain', 'clarify', 'what does', 'what is', 'how does', 'why', 'elaborate', 'different way', 'simpler', 'more detail']
        if any(kw in message_lower for kw in explain_keywords):
            return ChatIntent.EXPLAIN
        
        # Check for search intent
        search_keywords = ['find', 'search', 'look for', 'where is', 'show me', 'list', 'what are']
        if any(kw in message_lower for kw in search_keywords):
            return ChatIntent.SEARCH
        
        # Check for generate notes intent
        generate_notes_keywords = ['generate notes', 'create notes', 'study notes', 'learning notes', 'make notes', 'write notes', 'reading notes']
        if any(kw in message_lower for kw in generate_notes_keywords):
            return ChatIntent.GENERATE_NOTES
        
        # Check for generate code intent
        generate_code_keywords = ['generate code', 'create code', 'write code', 'code example', 'show code', 'implement', 'programming example']
        if any(kw in message_lower for kw in generate_code_keywords):
            return ChatIntent.GENERATE_CODE
        
        # Check for follow-up (references previous context)
        followup_keywords = ['this', 'that', 'it', 'those', 'these', 'above', 'previous', 'same', 'more about']
        if has_history and any(kw in message_lower for kw in followup_keywords):
            return ChatIntent.FOLLOWUP
        
        return ChatIntent.GENERAL
    
    def _get_intent_prompt(self, intent: str) -> str:
        """Get specialized prompt instructions based on intent."""
        prompts = {
            ChatIntent.SEARCH: """You are helping the user FIND specific information in course materials.
List relevant topics, files, and page numbers where this information can be found.
Be direct and organized with your search results.""",
            
            ChatIntent.SUMMARIZE: """You are helping the user get a SUMMARY of course content.
Provide a concise, well-structured summary with key points.
Use bullet points for clarity. Always cite the source materials.""",
            
            ChatIntent.EXPLAIN: """You are helping the user UNDERSTAND a concept better.
Explain clearly using simple language and examples where helpful.
If you're re-explaining something, try a different approach or analogy.""",
            
            ChatIntent.FOLLOWUP: """The user is asking a FOLLOW-UP question about the previous topic.
Build on the conversation context to provide a relevant answer.
Reference back to what was discussed before.""",
            
            ChatIntent.GENERATE_NOTES: """You are GENERATING comprehensive study notes based on course materials.

OUTPUT FORMAT (use this exact Markdown structure):
# Study Notes: [Topic Name]

## Overview
Brief 2-3 sentence introduction to the topic.

## Key Concepts
- **Concept 1**: Explanation
- **Concept 2**: Explanation
- **Concept 3**: Explanation

## Detailed Explanation
In-depth coverage of the topic with examples.

## Important Formulas/Definitions
List any formulas, theorems, or key definitions.

## Practice Questions
1. Question 1?
2. Question 2?

## Summary
3-4 sentence recap of the most important points.

## Sources
- List all sources used with page numbers

IMPORTANT: Make the notes comprehensive, well-organized, and ready to study from.""",
            
            ChatIntent.GENERATE_CODE: """You are GENERATING code examples based on course materials.

OUTPUT FORMAT (use this exact Markdown structure):
# Code Example: [Topic Name]

## Concept Overview
Brief explanation of what this code demonstrates.

## Code Implementation

```python
# Add clear comments explaining each section
# Use Python unless specified otherwise

def example_function():
    '''Docstring explaining purpose'''
    pass  # Implement based on course content
```

## Code Explanation
Step-by-step breakdown of how the code works.

## Usage Example
```python
# Show how to use the code
```

## Common Mistakes to Avoid
- Mistake 1 and how to fix it
- Mistake 2 and how to fix it

## Related Concepts
Links to other topics this connects to.

## Sources
- List all sources used with page numbers

IMPORTANT: Code must be syntactically correct, well-commented, and educational.
Supported languages: Python (default), JavaScript, Java, C++.""",
            
            ChatIntent.GENERAL: """You are an AI tutor helping the user learn from course materials.
Provide helpful, accurate responses based on the available content."""
        }
        return prompts.get(intent, prompts[ChatIntent.GENERAL])
    
    async def create_conversation(self, user_id: str, title: str = "New Chat") -> Dict[str, Any]:
        """Create a new conversation for a user."""
        result = self.supabase.table("conversations").insert({
            "user_id": user_id,
            "title": title,
            "rolling_summary": "",
            "message_count": 0
        }).execute()
        
        return result.data[0] if result.data else None
    
    async def get_conversation(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Get a conversation by ID."""
        result = self.supabase.table("conversations").select("*").eq(
            "id", conversation_id
        ).single().execute()
        
        return result.data if result.data else None
    
    async def list_conversations(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """List user's conversations, most recent first."""
        result = self.supabase.table("conversations").select("*").eq(
            "user_id", user_id
        ).order("updated_at", desc=True).limit(limit).execute()
        
        return result.data or []
    
    async def get_messages(
        self, 
        conversation_id: str, 
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get messages for a conversation."""
        query = self.supabase.table("chat_messages").select("*").eq(
            "conversation_id", conversation_id
        ).order("created_at", desc=False)
        
        if limit:
            query = query.limit(limit)
        
        result = query.execute()
        return result.data or []
    
    async def get_recent_messages(self, conversation_id: str) -> List[Dict[str, Any]]:
        """Get the most recent messages (strict 5-message window)."""
        result = self.supabase.table("chat_messages").select("*").eq(
            "conversation_id", conversation_id
        ).order("created_at", desc=True).limit(self.CONTEXT_WINDOW).execute()
        
        # Reverse to get chronological order
        messages = result.data or []
        messages.reverse()
        return messages
    
    async def _generate_summary(self, conversation_id: str) -> str:
        """Generate a rolling summary of the conversation."""
        conversation = await self.get_conversation(conversation_id)
        if not conversation:
            return ""
        
        existing_summary = conversation.get("rolling_summary", "")
        recent_messages = await self.get_recent_messages(conversation_id)
        
        if not recent_messages:
            return existing_summary
        
        # Format recent messages
        messages_text = "\n".join([
            f"{msg['role'].upper()}: {msg['content'][:300]}"
            for msg in recent_messages[-4:]
        ])
        
        if not existing_summary and len(recent_messages) < 3:
            return ""
        
        prompt = f"""Summarize this conversation in 2-3 sentences. Focus on: topics discussed, questions asked, and key information shared.

Previous Summary: {existing_summary if existing_summary else 'None'}

Recent Messages:
{messages_text}

Concise Summary:"""

        try:
            response = self.summarizer.invoke(prompt)
            return response.content.strip()
        except Exception as e:
            print(f"Summary generation error: {e}")
            return existing_summary
    
    async def _update_rolling_summary(self, conversation_id: str):
        """Update the rolling summary in the database."""
        summary = await self._generate_summary(conversation_id)
        
        self.supabase.table("conversations").update({
            "rolling_summary": summary
        }).eq("id", conversation_id).execute()
    
    async def _build_context(self, conversation_id: str) -> Tuple[str, bool]:
        """
        Build context for the LLM using rolling summary + last 5 messages ONLY.
        Returns: (context_string, has_history)
        """
        conversation = await self.get_conversation(conversation_id)
        rolling_summary = conversation.get("rolling_summary", "") if conversation else ""
        
        recent_messages = await self.get_recent_messages(conversation_id)
        has_history = len(recent_messages) > 0
        
        context_parts = []
        
        if rolling_summary:
            context_parts.append(f"[Previous Conversation Summary]\n{rolling_summary}")
        
        if recent_messages:
            # Only last 5 messages
            messages_text = "\n".join([
                f"{msg['role'].upper()}: {msg['content']}"
                for msg in recent_messages[-5:]
            ])
            context_parts.append(f"[Recent Conversation (Last 5 messages)]\n{messages_text}")
        
        return "\n\n".join(context_parts), has_history
    
    def _build_system_prompt(self, intent: str) -> str:
        """Build the system prompt with strict grounding rules."""
        intent_instruction = self._get_intent_prompt(intent)
        
        return f"""{intent_instruction}

=== CRITICAL RULES (YOU MUST FOLLOW) ===

1. ONLY USE PROVIDED CONTEXT: You may ONLY answer using information from the [Course Materials] section below. 
   Do NOT use any external knowledge or make up information.

2. SAY "I DON'T KNOW": If the answer is NOT in the provided course materials, you MUST say:
   "I couldn't find this information in the uploaded course materials. Would you like me to search for something else, or would you like to try rephrasing your question?"

3. CITE YOUR SOURCES: For EVERY piece of information you provide, include a citation in this EXACT format:
   (Source: [filename], Page [number])
   
   Example: "Machine learning uses algorithms to learn from data (Source: ML_Introduction.pdf, Page 12)."

4. FORMAT CITATIONS AT END: Also provide a "Sources Used" section at the end listing all referenced materials.

5. BE ACADEMICALLY RELIABLE: Only state facts that are directly supported by the course materials.
   If information is partial or unclear in the materials, say so.

=== END OF RULES ==="""
    
    async def chat(
        self, 
        conversation_id: str, 
        user_message: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Process a chat message and generate a grounded response.
        Uses intent detection, RAG retrieval, and citation-based formatting.
        """
        # Store user message
        user_msg_result = self.supabase.table("chat_messages").insert({
            "conversation_id": conversation_id,
            "role": "user",
            "content": user_message,
            "sources": []
        }).execute()
        
        # Update message count
        conv_data = self.supabase.table("conversations").select("message_count").eq("id", conversation_id).single().execute()
        current_count = conv_data.data.get("message_count", 0) if conv_data.data else 0
        
        self.supabase.table("conversations").update({
            "message_count": current_count + 1
        }).eq("id", conversation_id).execute()
        
        # Build conversation context (last 5 messages only)
        conversation_context, has_history = await self._build_context(conversation_id)
        
        # Detect user intent
        intent = self._detect_intent(user_message, has_history)
        
        # Get RAG results for grounding
        rag_response = await self.rag_service.ask(user_message, limit=5)
        
        # Build course materials context with clear source attribution
        course_materials = ""
        if rag_response.sources:
            materials_parts = []
            for i, src in enumerate(rag_response.sources):
                page_info = f", Page {src.get('page_number')}" if src.get('page_number') else ""
                materials_parts.append(
                    f"--- Source {i+1}: {src['file_name']}{page_info} ---\n{src['excerpt']}"
                )
            course_materials = "\n\n".join(materials_parts)
        else:
            course_materials = "No relevant course materials found for this query."
        
        # Build the full prompt
        system_prompt = self._build_system_prompt(intent)
        
        full_prompt = f"""{system_prompt}

[Conversation Context]
{conversation_context if conversation_context else "This is the start of the conversation."}

[Course Materials]
{course_materials}

[User's Question]
{user_message}

[Your Response (remember to cite sources)]:"""

        # Generate response
        try:
            response = self.llm.invoke(full_prompt)
            assistant_content = response.content
        except Exception as e:
            assistant_content = f"I apologize, but I encountered an error processing your request: {str(e)}"
        
        # Store assistant response with sources
        sources_data = rag_response.sources if rag_response.sources else []
        
        assistant_msg_result = self.supabase.table("chat_messages").insert({
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": assistant_content,
            "sources": sources_data
        }).execute()
        
        assistant_msg = assistant_msg_result.data[0] if assistant_msg_result.data else None
        
        # Update message count
        self.supabase.table("conversations").update({
            "message_count": current_count + 2
        }).eq("id", conversation_id).execute()
        
        # Update rolling summary periodically (every 4 messages)
        if (current_count + 2) % 4 == 0:
            await self._update_rolling_summary(conversation_id)
        
        # Auto-generate title from first message
        if current_count == 0:
            await self._generate_title(conversation_id, user_message)
        
        return {
            "conversation_id": conversation_id,
            "message": assistant_msg,
            "sources": sources_data,
            "intent": intent
        }
    
    async def _generate_title(self, conversation_id: str, first_message: str):
        """Generate a title for the conversation based on first message."""
        try:
            prompt = f"Generate a short title (max 5 words) for a conversation starting with: '{first_message[:150]}'\n\nTitle:"
            response = self.summarizer.invoke(prompt)
            title = response.content.strip().strip('"\'')[:80]
            
            self.supabase.table("conversations").update({
                "title": title
            }).eq("id", conversation_id).execute()
        except Exception as e:
            print(f"Title generation error: {e}")
    
    async def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation and its messages."""
        try:
            self.supabase.table("conversations").delete().eq(
                "id", conversation_id
            ).execute()
            return True
        except Exception as e:
            print(f"Delete error: {e}")
            return False
