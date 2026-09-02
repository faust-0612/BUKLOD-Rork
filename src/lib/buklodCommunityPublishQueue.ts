type PublishJob = {
  id: string;
  notice: string;
  status: 'running' | 'done' | 'error';
};

type Listener = (jobs: PublishJob[]) => void;

const listeners = new Set<Listener>();
let jobs: PublishJob[] = [];

function notify() {
  const snapshot = jobs.map(job => ({ ...job }));
  listeners.forEach(listener => listener(snapshot));
}

export function subscribeCommunityPublishQueue(listener: Listener) {
  listeners.add(listener);
  listener(jobs.map(job => ({ ...job })));

  return () => {
    listeners.delete(listener);
  };
}

export function getCommunityPublishNotice() {
  const active =
    jobs.find(job => job.status === 'running') ??
    jobs.find(job => job.status === 'error') ??
    jobs[0];

  return active?.notice ?? null;
}

export function enqueueCommunityPublish(
  startNotice: string,
  work: (setNotice: (notice: string) => void) => Promise<void>
) {
  const id = `publish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: PublishJob = {
    id,
    notice: startNotice,
    status: 'running',
  };

  jobs = [...jobs, job];
  notify();

  void (async () => {
    try {
      await work(notice => {
        job.notice = notice;
        notify();
      });
      job.status = 'done';
      job.notice = 'Posted.';
      notify();
    } catch (error) {
      job.status = 'error';
      job.notice =
        error instanceof Error
          ? error.message
          : 'Posting failed.';
      notify();
      throw error;
    } finally {
      setTimeout(() => {
        jobs = jobs.filter(item => item.id !== id);
        notify();
      }, job.status === 'error' ? 8000 : 2500);
    }
  })();
}
