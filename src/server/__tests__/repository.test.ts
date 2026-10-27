import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import admin from 'firebase-admin';
import {
  initRepositories,
  getPlanRepository,
  getShareRepository,
  setRepositories,
  getActiveStoreType,
  InMemoryRepository,
  FirestoreRepository,
} from '../repositories/index.js';
import type { SavedPlan, WizardInput, PlanOutput } from '../../shared/schemas.js';

describe('Repository Pattern & Storage Backends', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    // Reset to in-memory test repo
    initRepositories({ forceType: 'in-memory' });
  });

  describe('Repository Selection & Safety Checks', () => {
    it('selects InMemoryRepository in test environment by default', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.USE_IN_MEMORY_STORE;

      const { planRepo, shareRepo, storeType } = initRepositories();
      expect(storeType).toBe('in-memory');
      expect(planRepo).toBeInstanceOf(InMemoryRepository);
      expect(shareRepo).toBeInstanceOf(InMemoryRepository);
      expect(getActiveStoreType()).toBe('in-memory');
    });

    it('selects InMemoryRepository when USE_IN_MEMORY_STORE=true in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.USE_IN_MEMORY_STORE = 'true';

      const { storeType } = initRepositories();
      expect(storeType).toBe('in-memory');
    });

    it('FAILS FAST when NODE_ENV=production and in-memory store is attempted', () => {
      process.env.NODE_ENV = 'production';
      process.env.USE_IN_MEMORY_STORE = 'true';

      expect(() => {
        initRepositories();
      }).toThrow(/FATAL: InMemoryRepository cannot be used when NODE_ENV=production/);
    });

    it('FAILS FAST when NODE_ENV=production and forceType is in-memory', () => {
      process.env.NODE_ENV = 'production';

      expect(() => {
        initRepositories({ forceType: 'in-memory' });
      }).toThrow(/FATAL: InMemoryRepository cannot be used when NODE_ENV=production/);
    });
  });

  describe('InMemoryRepository', () => {
    let repo: InMemoryRepository;

    const sampleInput: WizardInput = {
      eventType: 'birthday',
      subEvents: [],
      eventDate: '2026-11-20',
      city: 'Mumbai',
      guestCount: 30,
      totalBudget: 20000,
      theme: 'Retro Disco',
      dietaryPreferences: [],
      culturalNotes: '',
      language: 'english',
    };

    const samplePlan: PlanOutput = {
      summary: 'Retro Disco Birthday',
      budget: [{ id: '1', category: 'Music', suggestedPercent: 100, amount: 20000, actual: 20000 }],
      timeline: [],
      vendors: [],
      ideas: [],
    };

    beforeEach(() => {
      repo = new InMemoryRepository();
    });

    it('saves and retrieves plans correctly', async () => {
      const plan: SavedPlan = {
        id: 'plan_123',
        input: sampleInput,
        plan: samplePlan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await repo.savePlan(plan);
      const fetched = await repo.getPlan('plan_123');
      expect(fetched).toEqual(plan);

      const nonExistent = await repo.getPlan('does_not_exist');
      expect(nonExistent).toBeNull();
    });

    it('creates and retrieves a share snapshot with ISO expiresAt', async () => {
      const { shareToken, expiresAt } = await repo.createShare(sampleInput, samplePlan);
      expect(shareToken).toHaveLength(32);
      expect(typeof expiresAt).toBe('string');
      expect(new Date(expiresAt).toISOString()).toBe(expiresAt);

      const fetched = await repo.getShare(shareToken);
      expect(fetched).not.toBeNull();
      expect(fetched?.shareToken).toBe(shareToken);
      expect(fetched?.plan.summary).toBe('Retro Disco Birthday');
      expect(fetched?.expiresAt).toBeDefined();
    });

    it('returns null when an in-memory share snapshot has expired', async () => {
      const expiredToken = 'expired_snap_123';
      const pastDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago

      repo.seedShare(expiredToken, {
        id: `share_${expiredToken}`,
        shareToken: expiredToken,
        input: sampleInput,
        plan: samplePlan,
        createdAt: pastDate.toISOString(),
        updatedAt: pastDate.toISOString(),
        expiresAt: {
          toMillis: () => pastDate.getTime(),
          toDate: () => pastDate,
        },
      });

      const result = await repo.getShare(expiredToken);
      expect(result).toBeNull();
    });

    it('clears in-memory data on clear()', async () => {
      await repo.savePlan({
        id: 'p1',
        input: sampleInput,
        plan: samplePlan,
        createdAt: '',
        updatedAt: '',
      });
      repo.clear();
      expect(await repo.getPlan('p1')).toBeNull();
    });
  });

  describe('FirestoreRepository TTL & Production Path', () => {
    it('creates share with real Firestore Timestamp and verifies TTL expiry check', async () => {
      const firestoreRepo = new FirestoreRepository();

      const mockCollectionSet = vi.fn().mockResolvedValue(undefined);
      const mockDocGet = vi.fn();
      const mockDoc = vi.fn((docId: string) => ({
        set: mockCollectionSet,
        get: mockDocGet,
      }));
      const mockCollection = vi.fn((name: string) => ({
        doc: mockDoc,
      }));

      const mockFirestore = {
        collection: mockCollection,
      } as unknown as FirebaseFirestore.Firestore;

      // Mock getDb to return the mock firestore client
      vi.spyOn(firestoreRepo, 'getDb').mockReturnValue(mockFirestore);

      const sampleInput: WizardInput = {
        eventType: 'birthday',
        subEvents: [],
        eventDate: '2026-11-20',
        city: 'Mumbai',
        guestCount: 30,
        totalBudget: 20000,
        theme: '',
        dietaryPreferences: [],
        culturalNotes: '',
        language: 'english',
      };

      const samplePlan: PlanOutput = {
        summary: 'Test summary',
        budget: [],
        timeline: [],
        vendors: [],
        ideas: [],
      };

      // 1. Test savePlan calls collection('plans')
      const planDoc: SavedPlan = {
        id: 'prod_plan_1',
        input: sampleInput,
        plan: samplePlan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await firestoreRepo.savePlan(planDoc);
      expect(mockCollection).toHaveBeenCalledWith('plans');
      expect(mockDoc).toHaveBeenCalledWith('prod_plan_1');
      expect(mockCollectionSet).toHaveBeenCalledWith(planDoc, { merge: true });

      // 2. Test createShare calls collection('shares') with a real admin.firestore.Timestamp
      const shareResult = await firestoreRepo.createShare(sampleInput, samplePlan);
      expect(mockCollection).toHaveBeenCalledWith('shares');
      expect(mockDoc).toHaveBeenCalledWith(shareResult.shareToken);
      const setCallArgs = mockCollectionSet.mock.calls[1][0];
      expect(setCallArgs.expiresAt).toBeInstanceOf(admin.firestore.Timestamp);
      expect(typeof shareResult.expiresAt).toBe('string');

      // 3. Test getShare returns null when document does not exist
      mockDocGet.mockResolvedValueOnce({ exists: false });
      const notFound = await firestoreRepo.getShare('non_existent');
      expect(notFound).toBeNull();

      // 4. Test getShare returns null when document has expired
      const pastDate = new Date(Date.now() - 1000 * 60);
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'share_expired',
          shareToken: 'token_expired',
          input: sampleInput,
          plan: samplePlan,
          createdAt: pastDate.toISOString(),
          updatedAt: pastDate.toISOString(),
          expiresAt: admin.firestore.Timestamp.fromDate(pastDate),
        }),
      });
      const expiredDoc = await firestoreRepo.getShare('token_expired');
      expect(expiredDoc).toBeNull();

      // 5. Test getShare returns clean SavedPlan with ISO expiresAt when not expired
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10);
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'share_active',
          shareToken: 'token_active',
          input: sampleInput,
          plan: samplePlan,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: admin.firestore.Timestamp.fromDate(futureDate),
        }),
      });
      const activeDoc = await firestoreRepo.getShare('token_active');
      expect(activeDoc).not.toBeNull();
      expect(activeDoc?.shareToken).toBe('token_active');
      expect(typeof activeDoc?.expiresAt).toBe('string');
      expect(new Date(activeDoc!.expiresAt!).getTime()).toBeGreaterThan(Date.now());

      // 6. Test getShare fails closed when expiresAt is missing
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'share_no_expiry',
          shareToken: 'token_no_expiry',
          input: sampleInput,
          plan: samplePlan,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
      const noExpiryDoc = await firestoreRepo.getShare('token_no_expiry');
      expect(noExpiryDoc).toBeNull();

      // 7. Test getShare fails closed when expiresAt is corrupt (not Timestamp or Date)
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'share_corrupt_expiry',
          shareToken: 'token_corrupt_expiry',
          input: sampleInput,
          plan: samplePlan,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: 'not-a-timestamp-or-date',
        }),
      });
      const corruptDoc = await firestoreRepo.getShare('token_corrupt_expiry');
      expect(corruptDoc).toBeNull();

      // 8. Test getPlan maps through savedPlanSchema
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => planDoc,
      });
      const fetchedPlan = await firestoreRepo.getPlan('prod_plan_1');
      expect(fetchedPlan?.id).toBe('prod_plan_1');
    });
  });
});
