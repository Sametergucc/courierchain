"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Job, JobStatus, RentalType } from "@/lib/constants";

interface JobContextType {
  jobs: Job[];
  activeJob: Job | null;
  addJob: (job: Job) => void;
  updateJobStatus: (jobId: string, status: JobStatus, txSignature?: string) => void;
  setActiveJob: (job: Job | null) => void;
  getJobByHash: (hash: string) => Job | undefined;
}

const JobContext = createContext<JobContextType | null>(null);

export function JobProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJobState] = useState<Job | null>(null);

  const addJob = useCallback((job: Job) => {
    setJobs((prev) => [...prev, job]);
    setActiveJobState(job);
  }, []);

  const updateJobStatus = useCallback(
    (jobId: string, status: JobStatus, txSignature?: string) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? { ...j, status, ...(txSignature ? { txSignature } : {}) }
            : j
        )
      );
      setActiveJobState((prev) =>
        prev?.id === jobId
          ? { ...prev, status, ...(txSignature ? { txSignature } : {}) }
          : prev
      );
    },
    []
  );

  const setActiveJob = useCallback((job: Job | null) => {
    setActiveJobState(job);
  }, []);

  const getJobByHash = useCallback(
    (hash: string) => jobs.find((j) => j.jobHash === hash),
    [jobs]
  );

  return (
    <JobContext.Provider
      value={{ jobs, activeJob, addJob, updateJobStatus, setActiveJob, getJobByHash }}
    >
      {children}
    </JobContext.Provider>
  );
}

export function useJobs() {
  const ctx = useContext(JobContext);
  if (!ctx) throw new Error("useJobs must be used within JobProvider");
  return ctx;
}
