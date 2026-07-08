import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.constants';
import { UsersService } from '../../users/users.service';

export interface UserSyncJobData {
  clerkId: string;
}

/**
 * Example/first processor — background counterpart to
 * UsersController's synchronous POST /users/sync. Not currently enqueued
 * from anywhere; demonstrates the queue/processor wiring pattern for future
 * job types. See AGENTS.md for why this must not `await` inline in a
 * latency-sensitive request path if it's ever wired to a producer.
 */
@Processor(QUEUE_NAMES.USER_SYNC)
export class UserSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(UserSyncProcessor.name);

  constructor(private readonly usersService: UsersService) {
    super();
  }

  async process(job: Job<UserSyncJobData>): Promise<void> {
    await this.usersService.syncFromClerk(job.data.clerkId);
    this.logger.log(
      `Processed user.sync job ${job.id} for ${job.data.clerkId}`,
    );
  }
}
