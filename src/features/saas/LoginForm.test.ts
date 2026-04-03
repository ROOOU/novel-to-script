import { SignIn } from '@clerk/nextjs';
import { describe, expect, it } from 'vitest';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('passes the requested redirect target to Clerk', () => {
    const page = LoginForm({
      locale: 'en-US',
      redirectUrl: 'https://app.012294.xyz/en-US/pricing',
    });

    expect(page.type).toBe('div');
    expect(page.props.children.type).toBe('div');
    expect(page.props.children.props.children.type).toBe(SignIn);
    expect(page.props.children.props.children.props).toMatchObject({
      routing: 'path',
      path: '/sign-in',
      signUpUrl: '/en-US/sign-up',
      fallbackRedirectUrl: 'https://app.012294.xyz/en-US/pricing',
    });
  });
});
