// src/store/drawingStore.ts
import { create } from 'zustand';
import { fetchDrawingsList, createDrawing, deleteDrawing, renameDrawing } from '../services/neo4j';

interface Drawing {
  id: string;
  name: string;
}

interface DrawingState {
  drawings: Drawing[];
  currentDrawingId: string | null;
  currentDrawingName: string;
  isLoading: boolean;
  isDirty: boolean; // [新增] 脏状态标记
  
  init: () => Promise<void>;
  addDrawing: (name: string) => Promise<void>;
  removeDrawing: (id: string) => Promise<void>;
  setCurrentDrawing: (id: string) => void;
  updateDrawingName: (id: string, newName: string) => Promise<void>;
  setDirty: (dirty: boolean) => void; // [新增] 设置脏状态
}

export const useDrawingStore = create<DrawingState>((set, get) => ({
  drawings: [],
  currentDrawingId: null,
  currentDrawingName: '',
  isLoading: false,
  isDirty: false, // [新增] 默认为 false

  init: async () => {
    set({ isLoading: true });
    try {
      const list = await fetchDrawingsList();
      set({ drawings: list });
      if (!get().currentDrawingId && list.length > 0) {
        set({ currentDrawingId: list[0].id, currentDrawingName: list[0].name, isDirty: false });
      } else if (list.length === 0) {
        await get().addDrawing('PID-001');
      }
    } catch (e) {
      console.error("Failed to init drawings", e);
    } finally {
      set({ isLoading: false });
    }
  },

  addDrawing: async (name: string) => {
    set({ isLoading: true });
    try {
      const newDrawing = await createDrawing(name);
      set(state => ({ 
        drawings: [...state.drawings, newDrawing],
        currentDrawingId: newDrawing.id,
        currentDrawingName: newDrawing.name,
        isDirty: false // 新图纸初始干净
      }));
    } finally {
      set({ isLoading: false });
    }
  },

  removeDrawing: async (id: string) => {
    await deleteDrawing(id);
    set(state => {
      const newDrawings = state.drawings.filter(d => d.id !== id);
      let nextId = state.currentDrawingId;
      let nextName = state.currentDrawingName;
      if (id === state.currentDrawingId) {
        nextId = newDrawings[0]?.id || null;
        nextName = newDrawings[0]?.name || '';
      }
      return { drawings: newDrawings, currentDrawingId: nextId, currentDrawingName: nextName, isDirty: false };
    });
  },

  setCurrentDrawing: (id: string) => {
    const drawing = get().drawings.find(d => d.id === id);
    if (drawing) {
      // 切换图纸时，重置 dirty 状态 (假设切换前已处理保存逻辑)
      set({ currentDrawingId: id, currentDrawingName: drawing.name, isDirty: false });
    }
  },

  updateDrawingName: async (id: string, newName: string) => {
    set(state => ({
      drawings: state.drawings.map(d => d.id === id ? { ...d, name: newName } : d),
      currentDrawingName: state.currentDrawingId === id ? newName : state.currentDrawingName
    }));
    try {
      await renameDrawing(id, newName);
    } catch (e) {
      console.error("Rename failed", e);
      await get().init(); 
    }
  },

  // [新增]
  setDirty: (dirty: boolean) => set({ isDirty: dirty })
}));