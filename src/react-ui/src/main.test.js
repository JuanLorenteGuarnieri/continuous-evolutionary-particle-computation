import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
function App() {
    return _jsx("div", { children: "CEPC UI Shell" });
}
describe('App', () => {
    it('renders without crashing', () => {
        render(_jsx(App, {}));
        expect(screen.getByText('CEPC UI Shell')).toBeInTheDocument();
    });
});
