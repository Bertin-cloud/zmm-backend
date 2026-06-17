import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the landing page with ZMM branding', () => {
    render(<App />);
    expect(screen.getByText(/ZMM/i)).toBeInTheDocument();
    expect(screen.getByText(/Zoom Meeting Model/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join meeting/i })).toBeInTheDocument();
  });
});
