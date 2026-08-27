import { toast } from 'sonner';

export const notify = {
  success(message, description) {
    toast.success(message, description ? { description } : undefined);
  },
  error(message, description) {
    toast.error(message, description ? { description } : undefined);
  },
};
