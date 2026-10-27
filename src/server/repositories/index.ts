import type { PlanRepository, ShareRepository } from './types.js';
import { FirestoreRepository } from './firestore.js';
import { InMemoryRepository } from './inMemory.js';

export * from './types.js';
export { FirestoreRepository } from './firestore.js';
export { InMemoryRepository } from './inMemory.js';

let activePlanRepo: PlanRepository | null = null;
let activeShareRepo: ShareRepository | null = null;
let activeStoreType: 'firestore' | 'in-memory' | null = null;

export interface InitRepoOptions {
  forceType?: 'firestore' | 'in-memory';
}

/**
 * Initializes the storage repositories based on environment.
 * - Production: Always selects FirestoreRepository. If in-memory is selected, fails fast.
 * - Test: Selects InMemoryRepository by default.
 * - Local Dev: Selects FirestoreRepository by default unless USE_IN_MEMORY_STORE === 'true'.
 * Logs which store is active at startup.
 */
export function initRepositories(options?: InitRepoOptions): {
  planRepo: PlanRepository;
  shareRepo: ShareRepository;
  storeType: 'firestore' | 'in-memory';
} {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const explicitlyConfiguredInMemory = process.env.USE_IN_MEMORY_STORE === 'true';

  let selectedType: 'firestore' | 'in-memory';

  if (options?.forceType) {
    selectedType = options.forceType;
  } else if (isTest) {
    selectedType = 'in-memory';
  } else if (explicitlyConfiguredInMemory) {
    selectedType = 'in-memory';
  } else {
    selectedType = 'firestore';
  }

  // Enforce production safety: Fail fast if in-memory store would be used in production
  if (isProduction && selectedType === 'in-memory') {
    throw new Error(
      'FATAL: InMemoryRepository cannot be used when NODE_ENV=production. FirestoreRepository is mandatory in production to ensure multi-instance data persistence and consistency on Cloud Run.',
    );
  }

  if (selectedType === 'firestore') {
    const firestoreRepo = new FirestoreRepository();
    if (isProduction) {
      firestoreRepo.getDb();
    }
    activePlanRepo = firestoreRepo;
    activeShareRepo = firestoreRepo;
    activeStoreType = 'firestore';
    if (!isTest) {
      process.stdout.write('📦 Active storage: FirestoreRepository (Google Cloud Firestore)\n');
    }
  } else {
    const memoryRepo = new InMemoryRepository();
    activePlanRepo = memoryRepo;
    activeShareRepo = memoryRepo;
    activeStoreType = 'in-memory';
    if (!isTest) {
      process.stdout.write('📦 Active storage: InMemoryRepository (Local in-memory dev store)\n');
    }
  }

  return { planRepo: activePlanRepo, shareRepo: activeShareRepo, storeType: activeStoreType };
}

export function getPlanRepository(): PlanRepository {
  if (!activePlanRepo) {
    initRepositories();
  }
  return activePlanRepo!;
}

export function getShareRepository(): ShareRepository {
  if (!activeShareRepo) {
    initRepositories();
  }
  return activeShareRepo!;
}

export function getActiveStoreType(): 'firestore' | 'in-memory' | null {
  return activeStoreType;
}

export function setRepositories(planRepo: PlanRepository, shareRepo: ShareRepository): void {
  activePlanRepo = planRepo;
  activeShareRepo = shareRepo;
  activeStoreType = planRepo instanceof FirestoreRepository ? 'firestore' : 'in-memory';
}
