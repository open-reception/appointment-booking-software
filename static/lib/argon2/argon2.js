var Module = typeof self !== "undefined" && typeof self.Module !== "undefined" ? self.Module : {};
var jsModule = Module;
var moduleOverrides = {};
var key;
for (key in Module) {
	if (Module.hasOwnProperty(key)) {
		moduleOverrides[key] = Module[key];
	}
}
var arguments_ = [];
var thisProgram = "./this.program";
var quit_ = function (status, toThrow) {
	throw toThrow;
};
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === "object";
ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
ENVIRONMENT_IS_NODE =
	typeof process === "object" &&
	typeof process.versions === "object" &&
	typeof process.versions.node === "string";
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
var scriptDirectory = "";
function locateFile(path) {
	if (Module["locateFile"]) {
		return Module["locateFile"](path, scriptDirectory);
	}
	return scriptDirectory + path;
}
var read_, readAsync, readBinary, setWindowTitle;
var nodeFS;
var nodePath;
if (ENVIRONMENT_IS_NODE) {
	if (ENVIRONMENT_IS_WORKER) {
		scriptDirectory = require("path").dirname(scriptDirectory) + "/";
	} else {
		scriptDirectory = __dirname + "/";
	}
	read_ = function shell_read(filename, binary) {
		if (!nodeFS) nodeFS = require("fs");
		if (!nodePath) nodePath = require("path");
		filename = nodePath["normalize"](filename);
		return nodeFS["readFileSync"](filename, binary ? null : "utf8");
	};
	readBinary = function readBinary(filename) {
		var ret = read_(filename, true);
		if (!ret.buffer) {
			ret = new Uint8Array(ret);
		}
		assert(ret.buffer);
		return ret;
	};
	if (process["argv"].length > 1) {
		thisProgram = process["argv"][1].replace(/\\/g, "/");
	}
	arguments_ = process["argv"].slice(2);
	if (typeof module !== "undefined") {
		module["exports"] = Module;
	}
	process["on"]("uncaughtException", function (ex) {
		if (!(ex instanceof ExitStatus)) {
			throw ex;
		}
	});
	process["on"]("unhandledRejection", abort);
	quit_ = function (status) {
		process["exit"](status);
	};
	Module["inspect"] = function () {
		return "[Emscripten Module object]";
	};
} else if (ENVIRONMENT_IS_SHELL) {
	if (typeof read != "undefined") {
		read_ = function shell_read(f) {
			return read(f);
		};
	}
	readBinary = function readBinary(f) {
		var data;
		if (typeof readbuffer === "function") {
			return new Uint8Array(readbuffer(f));
		}
		data = read(f, "binary");
		assert(typeof data === "object");
		return data;
	};
	if (typeof scriptArgs != "undefined") {
		arguments_ = scriptArgs;
	} else if (typeof arguments != "undefined") {
		arguments_ = arguments;
	}
	if (typeof quit === "function") {
		quit_ = function (status) {
			quit(status);
		};
	}
	if (typeof print !== "undefined") {
		if (typeof console === "undefined") console = {};
		console.log = print;
		console.warn = console.error = typeof printErr !== "undefined" ? printErr : print;
	}
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
	if (ENVIRONMENT_IS_WORKER) {
		scriptDirectory = self.location.href;
	} else if (typeof document !== "undefined" && document.currentScript) {
		scriptDirectory = document.currentScript.src;
	}
	if (scriptDirectory.indexOf("blob:") !== 0) {
		scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1);
	} else {
		scriptDirectory = "";
	}
	{
		read_ = function (url) {
			var xhr = new XMLHttpRequest();
			xhr.open("GET", url, false);
			xhr.send(null);
			return xhr.responseText;
		};
		if (ENVIRONMENT_IS_WORKER) {
			readBinary = function (url) {
				var xhr = new XMLHttpRequest();
				xhr.open("GET", url, false);
				xhr.responseType = "arraybuffer";
				xhr.send(null);
				return new Uint8Array(xhr.response);
			};
		}
		readAsync = function (url, onload, onerror) {
			var xhr = new XMLHttpRequest();
			xhr.open("GET", url, true);
			xhr.responseType = "arraybuffer";
			xhr.onload = function () {
				if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
					onload(xhr.response);
					return;
				}
				onerror();
			};
			xhr.onerror = onerror;
			xhr.send(null);
		};
	}
	setWindowTitle = function (title) {
		document.title = title;
	};
} else {
}
var out = Module["print"] || console.log.bind(console);
var err = Module["printErr"] || console.warn.bind(console);
for (key in moduleOverrides) {
	if (moduleOverrides.hasOwnProperty(key)) {
		Module[key] = moduleOverrides[key];
	}
}
moduleOverrides = null;
if (Module["arguments"]) arguments_ = Module["arguments"];
if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
if (Module["quit"]) quit_ = Module["quit"];
var wasmBinary;
if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
var noExitRuntime = Module["noExitRuntime"] || true;
if (typeof WebAssembly !== "object") {
	abort("no native wasm support detected");
}
var wasmMemory;
var ABORT = false;
var EXITSTATUS;
function assert(condition, text) {
	if (!condition) {
		abort("Assertion failed: " + text);
	}
}
var ALLOC_NORMAL = 0;
var ALLOC_STACK = 1;
function allocate(slab, allocator) {
	var ret;
	if (allocator == ALLOC_STACK) {
		ret = stackAlloc(slab.length);
	} else {
		ret = _malloc(slab.length);
	}
	if (slab.subarray || slab.slice) {
		HEAPU8.set(slab, ret);
	} else {
		HEAPU8.set(new Uint8Array(slab), ret);
	}
	return ret;
}
var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;
function UTF8ArrayToString(heap, idx, maxBytesToRead) {
	var endIdx = idx + maxBytesToRead;
	var endPtr = idx;
	while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;
	if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
		return UTF8Decoder.decode(heap.subarray(idx, endPtr));
	} else {
		var str = "";
		while (idx < endPtr) {
			var u0 = heap[idx++];
			if (!(u0 & 128)) {
				str += String.fromCharCode(u0);
				continue;
			}
			var u1 = heap[idx++] & 63;
			if ((u0 & 224) == 192) {
				str += String.fromCharCode(((u0 & 31) << 6) | u1);
				continue;
			}
			var u2 = heap[idx++] & 63;
			if ((u0 & 240) == 224) {
				u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
			} else {
				u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heap[idx++] & 63);
			}
			if (u0 < 65536) {
				str += String.fromCharCode(u0);
			} else {
				var ch = u0 - 65536;
				str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
			}
		}
	}
	return str;
}
function UTF8ToString(ptr, maxBytesToRead) {
	return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
}
function alignUp(x, multiple) {
	if (x % multiple > 0) {
		x += multiple - (x % multiple);
	}
	return x;
}
var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
function updateGlobalBufferAndViews(buf) {
	buffer = buf;
	Module["HEAP8"] = HEAP8 = new Int8Array(buf);
	Module["HEAP16"] = HEAP16 = new Int16Array(buf);
	Module["HEAP32"] = HEAP32 = new Int32Array(buf);
	Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
	Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
	Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
	Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
	Module["HEAPF64"] = HEAPF64 = new Float64Array(buf);
}
var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 16777216;
var wasmTable;
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
function preRun() {
	if (Module["preRun"]) {
		if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
		while (Module["preRun"].length) {
			addOnPreRun(Module["preRun"].shift());
		}
	}
	callRuntimeCallbacks(__ATPRERUN__);
}
function initRuntime() {
	runtimeInitialized = true;
	callRuntimeCallbacks(__ATINIT__);
}
function postRun() {
	if (Module["postRun"]) {
		if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
		while (Module["postRun"].length) {
			addOnPostRun(Module["postRun"].shift());
		}
	}
	callRuntimeCallbacks(__ATPOSTRUN__);
}
function addOnPreRun(cb) {
	__ATPRERUN__.unshift(cb);
}
function addOnInit(cb) {
	__ATINIT__.unshift(cb);
}
function addOnPostRun(cb) {
	__ATPOSTRUN__.unshift(cb);
}
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;
function addRunDependency(id) {
	runDependencies++;
	if (Module["monitorRunDependencies"]) {
		Module["monitorRunDependencies"](runDependencies);
	}
}
function removeRunDependency(id) {
	runDependencies--;
	if (Module["monitorRunDependencies"]) {
		Module["monitorRunDependencies"](runDependencies);
	}
	if (runDependencies == 0) {
		if (runDependencyWatcher !== null) {
			clearInterval(runDependencyWatcher);
			runDependencyWatcher = null;
		}
		if (dependenciesFulfilled) {
			var callback = dependenciesFulfilled;
			dependenciesFulfilled = null;
			callback();
		}
	}
}
Module["preloadedImages"] = {};
Module["preloadedAudios"] = {};
function abort(what) {
	if (Module["onAbort"]) {
		Module["onAbort"](what);
	}
	what += "";
	err(what);
	ABORT = true;
	EXITSTATUS = 1;
	what = "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
	var e = new WebAssembly.RuntimeError(what);
	throw e;
}
var dataURIPrefix = "data:application/octet-stream;base64,";
function isDataURI(filename) {
	return filename.startsWith(dataURIPrefix);
}
function isFileURI(filename) {
	return filename.startsWith("file://");
}
var wasmBinaryFile = "argon2.wasm";
if (!isDataURI(wasmBinaryFile)) {
	wasmBinaryFile = locateFile(wasmBinaryFile);
}
function getBinary(file) {
	try {
		if (file == wasmBinaryFile && wasmBinary) {
			return new Uint8Array(wasmBinary);
		}
		if (readBinary) {
			return readBinary(file);
		} else {
			throw "both async and sync fetching of the wasm failed";
		}
	} catch (err) {
		abort(err);
	}
}
function getBinaryPromise() {
	if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
		if (typeof fetch === "function" && !isFileURI(wasmBinaryFile)) {
			return fetch(wasmBinaryFile, { credentials: "same-origin" })
				.then(function (response) {
					if (!response["ok"]) {
						throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
					}
					return response["arrayBuffer"]();
				})
				.catch(function () {
					return getBinary(wasmBinaryFile);
				});
		} else {
			if (readAsync) {
				return new Promise(function (resolve, reject) {
					readAsync(
						wasmBinaryFile,
						function (response) {
							resolve(new Uint8Array(response));
						},
						reject
					);
				});
			}
		}
	}
	return Promise.resolve().then(function () {
		return getBinary(wasmBinaryFile);
	});
}
function createWasm() {
	var info = { a: asmLibraryArg };
	function receiveInstance(instance, module) {
		var exports = instance.exports;
		Module["asm"] = exports;
		wasmMemory = Module["asm"]["c"];
		updateGlobalBufferAndViews(wasmMemory.buffer);
		wasmTable = Module["asm"]["k"];
		addOnInit(Module["asm"]["d"]);
		removeRunDependency("wasm-instantiate");
	}
	addRunDependency("wasm-instantiate");
	function receiveInstantiationResult(result) {
		receiveInstance(result["instance"]);
	}
	function instantiateArrayBuffer(receiver) {
		return getBinaryPromise()
			.then(function (binary) {
				var result = WebAssembly.instantiate(binary, info);
				return result;
			})
			.then(receiver, function (reason) {
				err("failed to asynchronously prepare wasm: " + reason);
				abort(reason);
			});
	}
	function instantiateAsync() {
		if (
			!wasmBinary &&
			typeof WebAssembly.instantiateStreaming === "function" &&
			!isDataURI(wasmBinaryFile) &&
			!isFileURI(wasmBinaryFile) &&
			typeof fetch === "function"
		) {
			return fetch(wasmBinaryFile, { credentials: "same-origin" }).then(function (response) {
				var result = WebAssembly.instantiateStreaming(response, info);
				return result.then(receiveInstantiationResult, function (reason) {
					err("wasm streaming compile failed: " + reason);
					err("falling back to ArrayBuffer instantiation");
					return instantiateArrayBuffer(receiveInstantiationResult);
				});
			});
		} else {
			return instantiateArrayBuffer(receiveInstantiationResult);
		}
	}
	if (Module["instantiateWasm"]) {
		try {
			var exports = Module["instantiateWasm"](info, receiveInstance);
			return exports;
		} catch (e) {
			err("Module.instantiateWasm callback failed with error: " + e);
			return false;
		}
	}
	instantiateAsync();
	return {};
}
function callRuntimeCallbacks(callbacks) {
	while (callbacks.length > 0) {
		var callback = callbacks.shift();
		if (typeof callback == "function") {
			callback(Module);
			continue;
		}
		var func = callback.func;
		if (typeof func === "number") {
			if (callback.arg === undefined) {
				wasmTable.get(func)();
			} else {
				wasmTable.get(func)(callback.arg);
			}
		} else {
			func(callback.arg === undefined ? null : callback.arg);
		}
	}
}
function _emscripten_memcpy_big(dest, src, num) {
	HEAPU8.copyWithin(dest, src, src + num);
}
function emscripten_realloc_buffer(size) {
	try {
		wasmMemory.grow((size - buffer.byteLength + 65535) >>> 16);
		updateGlobalBufferAndViews(wasmMemory.buffer);
		return 1;
	} catch (e) {}
}
function _emscripten_resize_heap(requestedSize) {
	var oldSize = HEAPU8.length;
	requestedSize = requestedSize >>> 0;
	var maxHeapSize = 2147418112;
	if (requestedSize > maxHeapSize) {
		return false;
	}
	for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
		var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
		overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
		var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
		var replacement = emscripten_realloc_buffer(newSize);
		if (replacement) {
			return true;
		}
	}
	return false;
}
var asmLibraryArg = { a: _emscripten_memcpy_big, b: _emscripten_resize_heap };
var asm = createWasm();
var ___wasm_call_ctors = (Module["___wasm_call_ctors"] = function () {
	return (___wasm_call_ctors = Module["___wasm_call_ctors"] = Module["asm"]["d"]).apply(
		null,
		arguments
	);
});
var _argon2_hash = (Module["_argon2_hash"] = function () {
	return (_argon2_hash = Module["_argon2_hash"] = Module["asm"]["e"]).apply(null, arguments);
});
var _malloc = (Module["_malloc"] = function () {
	return (_malloc = Module["_malloc"] = Module["asm"]["f"]).apply(null, arguments);
});
var _free = (Module["_free"] = function () {
	return (_free = Module["_free"] = Module["asm"]["g"]).apply(null, arguments);
});
var _argon2_verify = (Module["_argon2_verify"] = function () {
	return (_argon2_verify = Module["_argon2_verify"] = Module["asm"]["h"]).apply(null, arguments);
});
var _argon2_error_message = (Module["_argon2_error_message"] = function () {
	return (_argon2_error_message = Module["_argon2_error_message"] = Module["asm"]["i"]).apply(
		null,
		arguments
	);
});
var _argon2_encodedlen = (Module["_argon2_encodedlen"] = function () {
	return (_argon2_encodedlen = Module["_argon2_encodedlen"] = Module["asm"]["j"]).apply(
		null,
		arguments
	);
});
var _argon2_hash_ext = (Module["_argon2_hash_ext"] = function () {
	return (_argon2_hash_ext = Module["_argon2_hash_ext"] = Module["asm"]["l"]).apply(
		null,
		arguments
	);
});
var _argon2_verify_ext = (Module["_argon2_verify_ext"] = function () {
	return (_argon2_verify_ext = Module["_argon2_verify_ext"] = Module["asm"]["m"]).apply(
		null,
		arguments
	);
});
var stackAlloc = (Module["stackAlloc"] = function () {
	return (stackAlloc = Module["stackAlloc"] = Module["asm"]["n"]).apply(null, arguments);
});
Module["allocate"] = allocate;
Module["UTF8ToString"] = UTF8ToString;
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
var calledRun;
function ExitStatus(status) {
	this.name = "ExitStatus";
	this.message = "Program terminated with exit(" + status + ")";
	this.status = status;
}
dependenciesFulfilled = function runCaller() {
	if (!calledRun) run();
	if (!calledRun) dependenciesFulfilled = runCaller;
};
function run(args) {
	args = args || arguments_;
	if (runDependencies > 0) {
		return;
	}
	preRun();
	if (runDependencies > 0) {
		return;
	}
	function doRun() {
		if (calledRun) return;
		calledRun = true;
		Module["calledRun"] = true;
		if (ABORT) return;
		initRuntime();
		if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
		postRun();
	}
	if (Module["setStatus"]) {
		Module["setStatus"]("Running...");
		setTimeout(function () {
			setTimeout(function () {
				Module["setStatus"]("");
			}, 1);
			doRun();
		}, 1);
	} else {
		doRun();
	}
}
Module["run"] = run;
if (Module["preInit"]) {
	if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
	while (Module["preInit"].length > 0) {
		Module["preInit"].pop()();
	}
}
run();
if (typeof module !== "undefined") module.exports = Module;
Module.unloadRuntime = function () {
	if (typeof self !== "undefined") {
		delete self.Module;
	}
	Module =
		jsModule =
		wasmMemory =
		wasmTable =
		asm =
		buffer =
		HEAP8 =
		HEAPU8 =
		HEAP16 =
		HEAPU16 =
		HEAP32 =
		HEAPU32 =
		HEAPF32 =
		HEAPF64 =
			undefined;
	if (typeof module !== "undefined") {
		delete module.exports;
	}
};
