// MockWritableStream.js
import { vi } from "vitest";

export class MockWritableStreamDefaultWriter {
  constructor(stream) {
    this.stream = stream;

    // Internal state
    this._closed = false;
    this._released = false;
    this._closedPromise = new Promise((resolve, reject) => {
      this._closedResolve = resolve;
      this._closedReject = reject;
    });

    // Mocked methods
    this.write = vi.fn((chunk) => {
      if (this._closed || this._released) {
        return Promise.reject(new TypeError("Cannot write to a closed or released writer"));
      }
      // Call the stream's write method
      return this.stream._writeChunk(chunk);
    });

    this.close = vi.fn(() => {
      if (this._closed || this._released) {
        return Promise.reject(new TypeError("Writer is already closed or released"));
      }
      this._closed = true;
      // Call the stream's close method
      return this.stream._closeStream().then(() => {
        this._closedResolve();
      });
    });

    this.abort = vi.fn((reason) => {
      if (this._closed || this._released) {
        return Promise.reject(new TypeError("Writer is already closed or released"));
      }
      this._closed = true;
      // Call the stream's abort method
      return this.stream._abortStream(reason).then(() => {
        this._closedReject(reason);
      });
    });

    this.releaseLock = vi.fn(() => {
      if (this._released) {
        throw new TypeError("Cannot release an already released lock");
      }
      this._released = true;
      // Unlock the stream
      this.stream._releaseWriter();
    });

    // Properties
    this.closed = this._closedPromise;
    this.ready = Promise.resolve();
    this.desiredSize = null; // Adjust as necessary
  }
}

export class MockWritableStream extends WritableStream {
  constructor() {
    // Initialize internal variables
    const chunks = [];
    let closedResolve, closedReject;
    const closedPromise = new Promise((resolve, reject) => {
      closedResolve = resolve;
      closedReject = reject;
    });

    // Internal locked state
    let _locked = false;

    // Override the 'locked' getter
    const lockedProperty = {
      get() {
        return _locked;
      },
    };

    // Define the underlying sink
    const underlyingSink = {
      write(chunk) {
        chunks.push(chunk);
        return Promise.resolve();
      },
      close() {
        closedResolve();
        return Promise.resolve();
      },
      abort(reason) {
        closedReject(reason);
        return Promise.resolve();
      },
    };

    super(underlyingSink);

    // Expose properties for testing
    this.chunks = chunks;
    this.closed = closedPromise;

    // Override the 'locked' property
    Object.defineProperty(this, "locked", lockedProperty);

    // Mock methods
    this.getWriter = vi.fn(() => {
      if (_locked) {
        throw new TypeError("Cannot get a writer from a locked stream");
      }
      _locked = true;
      const writer = new MockWritableStreamDefaultWriter(this);
      this._writer = writer;
      return writer;
    });

    this._writeChunk = (chunk) => {
      // Underlying sink's write method has already added the chunk to `chunks`
      return Promise.resolve();
    };

    this._closeStream = () => {
      // Underlying sink's close method has already resolved `closedPromise`
      return Promise.resolve();
    };

    this._abortStream = (reason) => {
      // Underlying sink's abort method has already rejected `closedPromise`
      return Promise.resolve();
    };

    this._releaseWriter = () => {
      _locked = false;
      this._writer = null;
    };
  }

  // Method to get the written chunks
  getChunks() {
    return this.chunks;
  }
}
