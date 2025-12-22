"""AI API endpoints for interacting with llama.cpp server"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import httpx
import os

from config.config_init import logger
from services.services_auth import get_current_user
from models.auth_models import User

router = APIRouter()

# Llama.cpp server URL - use service name in docker network
LLAMA_SERVER_URL = os.environ.get("LLAMA_SERVER_URL", "http://llama-server:8000")


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant" or "system"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 512


class ChatResponse(BaseModel):
    content: str
    model: str
    usage: Optional[dict] = None


@router.post("/ai/chat", response_model=ChatResponse)
async def chat_with_ai(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Chat with AI model (llama.cpp server)
    Requires authentication
    """
    try:
        # Prepare messages for llama.cpp server
        # Llama.cpp uses OpenAI-compatible format
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # Call llama.cpp server
        # Try non-streaming first, as server generates full response anyway
        # If that fails, fallback to streaming
        timeout = httpx.Timeout(300.0, connect=10.0, read=300.0, write=10.0, pool=10.0)
        
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            # First try non-streaming
            request_data_non_stream = {
                "messages": messages,
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "stream": False
            }
            
            logger.info(f"Trying non-streaming request to llama server: {LLAMA_SERVER_URL}/v1/chat/completions")
            logger.debug(f"Request data: {request_data_non_stream}")
            
            try:
                # Try non-streaming first
                response = await client.post(
                    f"{LLAMA_SERVER_URL}/v1/chat/completions",
                    json=request_data_non_stream,
                    headers={"Content-Type": "application/json", "Accept": "application/json"}
                )
                
                logger.info(f"Llama server response status: {response.status_code}")
                logger.debug(f"Response headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    # Try to read response immediately
                    try:
                        result = response.json()
                        logger.info(f"Successfully got non-streaming response")
                        logger.debug(f"Response keys: {list(result.keys())}")
                        
                        # Extract content
                        if "choices" in result and len(result["choices"]) > 0:
                            choice = result["choices"][0]
                            if "message" in choice and "content" in choice["message"]:
                                content = choice["message"]["content"] or ""
                                model = result.get("model", "unknown")
                                usage = result.get("usage", {})
                                
                                logger.info(f"AI chat request from user {current_user.username}, response length: {len(content)} chars")
                                
                                if content:
                                    return ChatResponse(
                                        content=content,
                                        model=model,
                                        usage=usage
                                    )
                    except Exception as non_stream_err:
                        logger.warning(f"Non-streaming failed: {non_stream_err}, trying streaming...")
                        # Fall through to streaming
                else:
                    logger.warning(f"Non-streaming returned {response.status_code}, trying streaming...")
                    # Fall through to streaming
            except Exception as non_stream_err:
                logger.warning(f"Non-streaming request failed: {non_stream_err}, trying streaming...")
                # Fall through to streaming
            
            # Fallback to streaming
            request_data = {
                "messages": messages,
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "stream": True  # Use streaming to receive response as it's generated
            }
            
            logger.info(f"Trying streaming request to llama server: {LLAMA_SERVER_URL}/v1/chat/completions")
            logger.debug(f"Request data: {request_data}")
            
            try:
                # Use streaming to collect response chunks
                content_parts = []
                model = "unknown"
                usage = {}
                full_response = ""
                
                async with client.stream(
                    "POST",
                    f"{LLAMA_SERVER_URL}/v1/chat/completions",
                    json=request_data,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "text/event-stream"
                    }
                ) as stream_response:
                    logger.info(f"Llama server response status: {stream_response.status_code}")
                    
                    if stream_response.status_code != 200:
                        error_chunks = []
                        async for chunk in stream_response.aiter_bytes():
                            error_chunks.append(chunk)
                        error_text = b''.join(error_chunks).decode('utf-8', errors='ignore')
                        logger.error(f"Llama server error: {stream_response.status_code} - {error_text}")
                        raise HTTPException(
                            status_code=stream_response.status_code,
                            detail=f"AI server error: {error_text}"
                        )
                    
                    # Process streaming response (Server-Sent Events format)
                    buffer = ""
                    chunk_count = 0
                    logger.info("Starting to read streaming response chunks...")
                    
                    async for chunk in stream_response.aiter_bytes():
                        chunk_count += 1
                        if chunk:
                            chunk_text = chunk.decode('utf-8', errors='ignore')
                            logger.debug(f"Received chunk #{chunk_count}: {len(chunk)} bytes, text preview: {chunk_text[:200]}")
                            buffer += chunk_text
                            
                            # Process complete lines (SSE format: "data: {...}\n\n")
                            while "\n\n" in buffer:
                                line, buffer = buffer.split("\n\n", 1)
                                line = line.strip()
                                
                                logger.debug(f"Processing SSE line: {line[:200]}")
                                
                                if line.startswith("data: "):
                                    data_str = line[6:]  # Remove "data: " prefix
                                    
                                    # Skip [DONE] marker
                                    if data_str.strip() == "[DONE]":
                                        logger.info("Received [DONE] marker - stream complete")
                                        continue
                                    
                                    try:
                                        import json
                                        chunk_data = json.loads(data_str)
                                        logger.debug(f"Parsed chunk data: {list(chunk_data.keys())}")
                                        
                                        # Extract content from delta
                                        if "choices" in chunk_data and len(chunk_data["choices"]) > 0:
                                            choice = chunk_data["choices"][0]
                                            logger.debug(f"Choice keys: {list(choice.keys())}")
                                            
                                            # Get model name from first chunk
                                            if model == "unknown" and "model" in chunk_data:
                                                model = chunk_data["model"]
                                                logger.info(f"Model identified: {model}")
                                            
                                            # Get usage from last chunk
                                            if "usage" in chunk_data:
                                                usage = chunk_data["usage"]
                                                logger.debug(f"Usage info: {usage}")
                                            
                                            # Extract content delta
                                            if "delta" in choice:
                                                logger.debug(f"Delta keys: {list(choice['delta'].keys())}")
                                                
                                                # Handle both 'content' and 'reasoning_content' fields
                                                # Some models (like Hermes 2 Pro) use reasoning_content for reasoning tokens
                                                # and regular content for final response
                                                delta_content = None
                                                if "content" in choice["delta"]:
                                                    delta_content = choice["delta"]["content"]
                                                elif "reasoning_content" in choice["delta"]:
                                                    # For reasoning models, we might want to include reasoning or skip it
                                                    # For now, include it as it's part of the model's output
                                                    delta_content = choice["delta"]["reasoning_content"]
                                                
                                                if delta_content:
                                                    content_parts.append(delta_content)
                                                    total_len = sum(len(p) for p in content_parts)
                                                    logger.debug(f"Received content chunk: '{delta_content}' ({len(delta_content)} chars), total: {total_len} chars")
                                                elif "role" in choice["delta"]:
                                                    logger.debug(f"Role delta: {choice['delta']['role']}")
                                                else:
                                                    logger.debug(f"Delta without content: {choice['delta']}")
                                            
                                            # Also check for full message (non-streaming fallback)
                                            elif "message" in choice and "content" in choice["message"]:
                                                msg_content = choice["message"]["content"]
                                                content_parts.append(msg_content)
                                                logger.info(f"Received full message: {len(msg_content)} chars")
                                        
                                        full_response += data_str + "\n"
                                        
                                    except json.JSONDecodeError as json_err:
                                        logger.warning(f"Failed to parse SSE chunk: {json_err}, data: {data_str[:200]}")
                                        continue
                                elif line.startswith(":"):
                                    # SSE comment, skip
                                    logger.debug(f"Skipping SSE comment: {line[:100]}")
                                    continue
                                elif not line:
                                    # Empty line, skip
                                    continue
                                else:
                                    logger.warning(f"Unexpected SSE line format: {line[:200]}")
                    
                    logger.info(f"Finished reading stream: {chunk_count} chunks received, buffer length: {len(buffer)}")
                    if buffer:
                        logger.debug(f"Remaining buffer: {buffer[:500]}")
                    
                    # Combine all content parts
                    content = "".join(content_parts)
                    
                    logger.info(f"Received complete streaming response: {len(content)} characters from {len(content_parts)} chunks")
                    logger.info(f"Content parts count: {len(content_parts)}, total length: {len(content)}")
                    logger.debug(f"Full response (first 500 chars): {content[:500]}")
                    logger.debug(f"Full raw response (first 2000 chars): {full_response[:2000]}")
                    
                    if not content:
                        logger.error(f"Empty content in streaming response!")
                        logger.error(f"Chunk count: {chunk_count}, content_parts: {len(content_parts)}")
                        logger.error(f"Full response length: {len(full_response)}")
                        logger.error(f"Full response data: {full_response[:2000]}")
                        logger.error(f"Remaining buffer: {buffer[:500]}")
                        
                        # Try to parse full_response as JSON to see what we got
                        if full_response:
                            try:
                                import json
                                # Try to find JSON objects in the response
                                lines = full_response.split('\n')
                                for line in lines:
                                    if line.strip().startswith('data: ') and line.strip() != 'data: [DONE]':
                                        try:
                                            data = json.loads(line[6:])
                                            logger.error(f"Found data object: {json.dumps(data, indent=2)}")
                                        except:
                                            pass
                            except Exception as e:
                                logger.error(f"Failed to parse full_response: {e}")
                        
                        raise HTTPException(
                            status_code=500,
                            detail="Empty response from AI server - check backend logs for details"
                        )
                    
                    logger.info(f"AI chat request from user {current_user.username}, response length: {len(content)} chars")
                    
                    return ChatResponse(
                        content=content,
                        model=model,
                        usage=usage
                    )
                        
            except httpx.TimeoutException as timeout_err:
                logger.error(f"Timeout reading streaming response from llama server: {timeout_err}")
                logger.error(f"Timeout details: {type(timeout_err)}, {str(timeout_err)}")
                raise HTTPException(
                    status_code=504,
                    detail="AI server response timeout - the model may be generating a very long response. Try reducing max_tokens."
                )
                
    except httpx.TimeoutException:
        logger.error("Timeout connecting to llama server")
        raise HTTPException(
            status_code=504,
            detail="AI server timeout - please try again"
        )
    except httpx.ConnectError:
        logger.error(f"Could not connect to llama server at {LLAMA_SERVER_URL}")
        raise HTTPException(
            status_code=503,
            detail="AI server is not available - please check if llama-server is running"
        )
    except Exception as e:
        logger.error(f"Error calling AI: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error communicating with AI: {str(e)}"
        )


@router.get("/ai/health")
async def ai_health_check():
    """
    Check if AI server is available
    Llama.cpp server may not have a /health endpoint, so we try a simple request
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Try to get models list or health endpoint
            # Llama.cpp server might have /health or we can check by trying a simple request
            try:
                response = await client.get(f"{LLAMA_SERVER_URL}/health")
                if response.status_code == 200:
                    return {
                        "status": "healthy",
                        "llama_server_url": LLAMA_SERVER_URL
                    }
            except:
                pass
            
            # If /health doesn't exist, try /v1/models (OpenAI-compatible endpoint)
            try:
                response = await client.get(f"{LLAMA_SERVER_URL}/v1/models")
                return {
                    "status": "healthy" if response.status_code == 200 else "unhealthy",
                    "llama_server_url": LLAMA_SERVER_URL
                }
            except:
                # If both fail, server is likely unavailable
                return {
                    "status": "unavailable",
                    "llama_server_url": LLAMA_SERVER_URL,
                    "note": "Could not reach llama server"
                }
    except Exception as e:
        return {
            "status": "unavailable",
            "error": str(e),
            "llama_server_url": LLAMA_SERVER_URL
        }

