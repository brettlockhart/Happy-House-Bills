import { reactive, ref, computed } from "vue";

globalThis.reactive = reactive;
globalThis.ref = ref;
globalThis.computed = computed;
globalThis.watchEffect = () => {};
