import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FixedAsset } from '@/features/accounting/domain/types/fixed-asset';
import { INITIAL_MOCK_FIXED_ASSETS } from './mock-fixed-assets';

interface FixedAssetsState {
  assets: FixedAsset[];
  getAsset: (id: string) => FixedAsset | undefined;
  saveAsset: (asset: FixedAsset) => void;
  deleteAsset: (id: string) => void;
  confirmAsset: (id: string) => void; // Set state to 'running'
  cancelAsset: (id: string) => void;
  modifyDepreciation: (id: string) => void;
}

export const useFixedAssetsStore = create<FixedAssetsState>()(
  persist(
    (set, get) => ({
      assets: INITIAL_MOCK_FIXED_ASSETS,

      getAsset: (id: string) => {
        return get().assets.find((a) => a.id === id);
      },

      saveAsset: (asset: FixedAsset) => {
        set((state) => {
          const index = state.assets.findIndex((a) => a.id === asset.id);
          if (index >= 0) {
            const updated = [...state.assets];
            updated[index] = asset;
            return { assets: updated };
          }
          return { assets: [asset, ...state.assets] };
        });
      },

      deleteAsset: (id: string) => {
        set((state) => ({
          assets: state.assets.filter((a) => a.id !== id),
        }));
      },

      confirmAsset: (id: string) => {
        set((state) => ({
          assets: state.assets.map((asset) =>
            asset.id === id ? { ...asset, state: 'running' } : asset,
          ),
        }));
      },

      cancelAsset: (id: string) => {
        set((state) => ({
          assets: state.assets.map((asset) =>
            asset.id === id ? { ...asset, state: 'cancel' } : asset,
          ),
        }));
      },

      modifyDepreciation: (id: string) => {
        // Toggle or recalculate depreciation
      },
    }),
    {
      name: 'accounting-fixed-assets-storage',
    },
  ),
);
