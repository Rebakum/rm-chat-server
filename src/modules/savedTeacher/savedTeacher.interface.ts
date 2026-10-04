export interface SavedTeacher {
  id: string;
  student: {
    id: string;
    name: string | null;
    displayName: string | null;
    photoURL: string | null;
  };
  teacher: {
    id: string;
    name: string | null;
    displayName: string | null;
    photoURL: string | null;
  };
  createdAt: Date;
}

export interface SavedTeacherQuery {
  page?: number;
  limit?: number;
}