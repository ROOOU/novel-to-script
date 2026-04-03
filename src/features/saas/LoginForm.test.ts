import { SignIn } from '@clerk/nextjs';
import { describe, expect, it } from 'vitest';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('passes a safe localized redirect target to Clerk', () => {
    const page = LoginForm({
      locale: 'en-US',
      redirectUrl: '/en-US/pricing',
    });

    expect(page.type).toBe('div');
    expect(page.props.children.type).toBe('div');
    expect(page.props.children.props.children.type).toBe(SignIn);
    expect(page.props.children.props.children.props).toMatchObject({
      routing: 'path',
      path: '/sign-in',
      signUpUrl: '/en-US/sign-up',
      fallbackRedirectUrl: '/en-US/pricing',
    });
  });

  it('falls back to projects for unsafe redirect targets', () => {
    const page = LoginForm({
      locale: 'en-US',
      redirectUrl: 'https://evil.example/en-US/pricing',
    });

    expect(page.props.children.props.children.props).toMatchObject({
      fallbackRedirectUrl: '/en-US/projects',
    });
  });
});
