# LawEye Backend

Backend service for LawEye - Alternative communication layer for bytebot desktop using local LLMs.

## Architecture

- **Desktop Service**: Communicates with bytebot-desktop via REST API
- **LLM Service**: Manages communication with LM Studio (orchestrator + position LLMs)
- **Tasks Service**: Orchestrates task execution
- **Gateway Service**: WebSocket gateway for real-time UI updates

## Environment Variables

- `BYTEBOT_DESKTOP_BASE_URL`: URL of bytebot-desktop service (default: `http://bytebot-desktop:9990`)
- `LM_STUDIO_BASE_URL`: LM Studio API URL (default: `http://localhost:1234/v1`)
- `MODEL_ORCHESTRATOR`: Orchestrator model name (default: `magistral-small-2509`)
- `MODEL_POSITION`: Position detection model name (default: `qwen2.5-vl:32b`)
- `PORT`: Server port (default: `9992`)

## Development

```bash
npm install
npm run start:dev
```

## Build

```bash
npm run build
npm run start:prod
```

## API Endpoints

- `POST /tasks` - Create and execute a new task
- `GET /tasks` - List all tasks
- `GET /tasks/:id` - Get task details
- `GET /health` - Health check

## WebSocket Events

Clients should join a task room with `join_task` event.

Events emitted:
- `task_event`: Real-time task events (orchestrator_thinking, position_request, position_detected, action_executed, screenshot_taken, error, etc.)

