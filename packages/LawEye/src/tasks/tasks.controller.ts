import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { TasksService, CreateTaskDto } from './tasks.service';

@Controller('tasks')
export class TasksController {
  private readonly logger = new Logger(TasksController.name);

  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() createTaskDto: CreateTaskDto) {
    try {
      if (!createTaskDto.description || !createTaskDto.description.trim()) {
        throw new HttpException(
          'Task description is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const task = this.tasksService.create({
        description: createTaskDto.description.trim(),
      });

      return task;
    } catch (error: any) {
      this.logger.error(`Error creating task: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to create task',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  findAll() {
    return this.tasksService.getAllTasks();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const task = this.tasksService.getTask(id);
    if (!task) {
      throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
    }
    return task;
  }
}

