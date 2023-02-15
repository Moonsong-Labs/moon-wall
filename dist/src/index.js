"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSuite = exports.MoonwallContext = exports.utils = exports.jimbo = exports.timbo = void 0;
var people_1 = require("./people");
Object.defineProperty(exports, "timbo", { enumerable: true, get: function () { return people_1.timbo; } });
Object.defineProperty(exports, "jimbo", { enumerable: true, get: function () { return people_1.jimbo; } });
exports.utils = __importStar(require("./cli/runner/util/runner-functions"));
var globalContext_1 = require("./cli/runner/internal/globalContext");
Object.defineProperty(exports, "MoonwallContext", { enumerable: true, get: function () { return globalContext_1.MoonwallContext; } });
var runner_functions_1 = require("./cli/runner/util/runner-functions");
Object.defineProperty(exports, "testSuite", { enumerable: true, get: function () { return runner_functions_1.testSuite; } });
//# sourceMappingURL=index.js.map