import { SignUp } from '@clerk/nextjs';
import { describe, expect, it } from 'vitest';
import { SignUpForm } from './SignUpForm';

describe('SignUpForm', () => {
  it('passes a safe localized redirect target to Clerk', () => {
    const page = SignUpForm({
      locale: 'en-US',
      redirectUrl: '/en-US/pricing',
    });

    expect(page.type).toBe('div');
    expect(page.props.children.type).toBe('div');
    expect(page.props.children.props.children.type).toBe(SignUp);
    expect(page.props.children.props.children.props).toMatchObject({
      routing: 'path',
      path: '/en-US/sign-up',
      signInUrl: '/en-US/login',
      fallbackRedirectUrl: '/en-US/pricing',
    });
  });

  it('falls back to projects for unsafe redirect targets', () => {
    const page = SignUpForm({
      locale: 'en-US',
      redirectUrl: 'https://evil.example/en-US/pricing',
    });

    expect(page.props.children.props.children.props).toMatchObject({
      fallbackRedirectUrl: '/en-US/projects',
    });
  });
});
