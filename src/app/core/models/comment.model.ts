export interface Comment {
  _id: string;
  projectId: string;
  userId: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
}
