import { render, screen } from '@testing-library/react';
import React from 'react';
function App() {
    return <div>CEPC UI Shell</div>;
}
describe('App', () => {
    it('renders without crashing', () => {
        render(<App />);
        expect(screen.getByText('CEPC UI Shell')).toBeInTheDocument();
    });
});
