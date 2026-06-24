export interface User {
    id: number;
    name: string;
    email: string;
}

export interface Subjects {
    [key: string]: {
        TGS: number | null;
        UH: number | null;
        UTS: number | null;
        SAJ: number | null;
    }
}

export interface StudentRecord {
    id: string;
    name: string;
    subjects: Subjects; // map mapel_id to scores
    tidakNaikKelas: boolean;
    absensi: {
        S: number;
        I: number;
        A: number;
    }
}

export interface ProjectData {
     subjectsList: string[]; // List of subject names
     students: StudentRecord[];
}

export interface Project {
    id?: number;
    name: string;
    student_count: number;
    subject_count: number;
    data: ProjectData;
    updated_at?: string;
}
