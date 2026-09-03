import type {
  PracticeSessionSubmission,
  PracticeSessionSubmissionResponse,
} from '@poker-range-trainer/contracts'

export interface PracticeRepository {
  submit(
    userId: string,
    submission: PracticeSessionSubmission,
  ): Promise<PracticeSessionSubmissionResponse>
}

export class PracticeService {
  constructor(private readonly repository: PracticeRepository) {}

  submit(
    userId: string,
    submission: PracticeSessionSubmission,
  ): Promise<PracticeSessionSubmissionResponse> {
    return this.repository.submit(userId, submission)
  }
}
