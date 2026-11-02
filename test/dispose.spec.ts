import { expect } from 'chai';
import jsdomGlobal from 'jsdom-global';
import sinon from 'sinon';
import Highlighter from '../src/index';
import { eventEmitter, INTERNAL_ERROR_EVENT } from '../src/util/const';
import { ERROR } from '../src/types/index';

type Listener = EventListenerOrEventListenerObject;

// Every listener still attached to a root, tracked through spies on the root itself.
const trackListeners = ($root: HTMLElement) => {
    const live = new Set<string>();
    const fns: Listener[] = [];
    const key = (type: string, fn: Listener) => {
        let idx = fns.indexOf(fn);

        if (idx === -1) {
            fns.push(fn);
            idx = fns.length - 1;
        }

        return `${type}#${idx}`;
    };
    const add = $root.addEventListener.bind($root);
    const remove = $root.removeEventListener.bind($root);

    sinon.stub($root, 'addEventListener').callsFake((type: string, fn: Listener, opts?: unknown) => {
        live.add(key(type, fn));
        add(type, fn, opts as AddEventListenerOptions);
    });
    sinon.stub($root, 'removeEventListener').callsFake((type: string, fn: Listener, opts?: unknown) => {
        live.delete(key(type, fn));
        remove(type, fn, opts as EventListenerOptions);
    });

    return live;
};

const errorHandlerCount = (): number => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const handlers = (eventEmitter as any).handlersMap[INTERNAL_ERROR_EVENT] as unknown[] | undefined;

    return handlers ? handlers.length : 0;
};

describe('Highlighter dispose', function () {
    this.timeout(50000);

    let cleanup: () => void;

    beforeEach(() => {
        cleanup = jsdomGlobal();
    });

    afterEach(() => {
        sinon.restore();
        cleanup();
    });

    it('leaves no listeners on the root and no handler on the shared emitter', () => {
        const N = 100;
        // Other spec files leave highlighters undisposed on the module-level emitter.
        const before = errorHandlerCount();
        const roots: Set<string>[] = [];

        for (let i = 0; i < N; i++) {
            // A detached root, as when a message is unmounted.
            const $root = document.createElement('div');

            $root.innerHTML = '<p>some text to highlight</p>';
            roots.push(trackListeners($root));

            const highlighter = new Highlighter({ $root });

            highlighter.run();
            highlighter.dispose();
        }

        roots.forEach(live => expect([...live]).to.deep.equal([]));
        expect(errorHandlerCount()).to.equal(before);
    });

    it('stops sending internal errors to a disposed highlighter, and keeps sending them to live ones', () => {
        const warn = sinon.stub(console, 'warn');
        const warnsFor = (fn: () => void) => {
            warn.resetHistory();
            fn();

            return warn.callCount;
        };
        const emitError = () => eventEmitter.emit(INTERNAL_ERROR_EVENT, { type: ERROR.DOM_SELECTION_EMPTY });
        // Verbose highlighters other spec files left alive also warn; count them first.
        const others = warnsFor(emitError);
        const disposed = new Highlighter({ $root: document.createElement('div'), verbose: true });
        const live = new Highlighter({ $root: document.createElement('div'), verbose: true });

        disposed.dispose();
        expect(warnsFor(emitError)).to.equal(others + 1);

        live.dispose();
        expect(warnsFor(emitError)).to.equal(others);
    });

    it('can be disposed twice without removing another highlighter\'s handler', () => {
        const before = errorHandlerCount();
        const a = new Highlighter({ $root: document.createElement('div') });
        const b = new Highlighter({ $root: document.createElement('div') });

        a.dispose();
        a.dispose();

        expect(errorHandlerCount()).to.equal(before + 1);

        b.dispose();

        expect(errorHandlerCount()).to.equal(before);
    });
});
