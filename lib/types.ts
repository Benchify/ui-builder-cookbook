import { Process } from '@e2b/sdk';

export interface GeneratedFile {
    path: string;
    contents: string;
}

export interface SandboxFile {
    path: string;
    data: string;
}

export interface ProcessResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface DeployResult {
    previewUrl: string;
    process: Process;
} 