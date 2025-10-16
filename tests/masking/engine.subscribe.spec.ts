import { MaskingEngine } from '../../src/masking/engine';

describe('MaskingEngine subscribe', () => {
  let engine: MaskingEngine;
  let mockListener: jest.Mock;

  beforeEach(() => {
    engine = new MaskingEngine();
    mockListener = jest.fn();
  });

  it('should fire listener on begin', () => {
    const unsubscribe = engine.subscribe(mockListener);
    
    engine.begin('area');
    
    expect(mockListener).toHaveBeenCalledTimes(1);
    
    unsubscribe();
  });

  it('should fire listener on append', () => {
    const unsubscribe = engine.subscribe(mockListener);
    
    engine.begin('area');
    mockListener.mockClear();
    
    // Mock viewport element and parameters
    const mockViewport = {
      getBoundingClientRect: () => ({ left: 0, top: 0 })
    } as HTMLElement;
    
    engine.appendScreenPoint(100, 100, mockViewport, { scale: 1, panX: 0, panY: 0 }, 1, { originX: 0, originY: 0, imgScale: 1 });
    
    expect(mockListener).toHaveBeenCalledTimes(1);
    
    unsubscribe();
  });

  it('should fire listener on backspace', () => {
    const unsubscribe = engine.subscribe(mockListener);
    
    engine.begin('area');
    const mockViewport = {
      getBoundingClientRect: () => ({ left: 0, top: 0 })
    } as HTMLElement;
    
    engine.appendScreenPoint(100, 100, mockViewport, { scale: 1, panX: 0, panY: 0 }, 1, { originX: 0, originY: 0, imgScale: 1 });
    mockListener.mockClear();
    
    engine.backspace();
    
    expect(mockListener).toHaveBeenCalledTimes(1);
    
    unsubscribe();
  });

  it('should fire listener on cancel', () => {
    const unsubscribe = engine.subscribe(mockListener);
    
    engine.begin('area');
    mockListener.mockClear();
    
    engine.cancel();
    
    expect(mockListener).toHaveBeenCalledTimes(1);
    
    unsubscribe();
  });

  it('should fire listener on finalize', () => {
    const unsubscribe = engine.subscribe(mockListener);
    
    engine.begin('area');
    const mockViewport = {
      getBoundingClientRect: () => ({ left: 0, top: 0 })
    } as HTMLElement;
    
    // Add 3 points to enable finalization
    engine.appendScreenPoint(100, 100, mockViewport, { scale: 1, panX: 0, panY: 0 }, 1, { originX: 0, originY: 0, imgScale: 1 });
    engine.appendScreenPoint(200, 100, mockViewport, { scale: 1, panX: 0, panY: 0 }, 1, { originX: 0, originY: 0, imgScale: 1 });
    engine.appendScreenPoint(200, 200, mockViewport, { scale: 1, panX: 0, panY: 0 }, 1, { originX: 0, originY: 0, imgScale: 1 });
    
    mockListener.mockClear();
    
    engine.finalize();
    
    expect(mockListener).toHaveBeenCalledTimes(1);
    
    unsubscribe();
  });

  it('should not fire listener after unsubscribe', () => {
    const unsubscribe = engine.subscribe(mockListener);
    unsubscribe();
    
    engine.begin('area');
    
    expect(mockListener).not.toHaveBeenCalled();
  });
});
