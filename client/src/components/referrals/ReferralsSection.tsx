/**
 * Referrals Section Component
 * Displays referral information, link, and statistics
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Copy, Check, Users, Gift, Sparkles, ExternalLink, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function ReferralsSection() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/referrals/info'],
    queryFn: () => apiClient.getReferralInfo(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const stats = data?.stats;

  const handleCopyLink = async () => {
    if (!stats?.referralLink) return;

    try {
      await navigator.clipboard.writeText(stats.referralLink);
      setCopied(true);
      toast.success('Referral link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Referrals</CardTitle>
          <CardDescription>Earn rewards by referring friends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Referrals</CardTitle>
          <CardDescription>Earn rewards by referring friends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <AlertCircle className="w-4 h-4" />
            <span>Failed to load referral information</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const remainingCapacity = stats.rewardsLimit - stats.rewardsEarned;
  const isAtLimit = stats.rewardsEarned >= stats.rewardsLimit;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Referrals
            </CardTitle>
            <CardDescription className="mt-1">
              Earn 20 enhancements for each friend who joins and completes onboarding
            </CardDescription>
          </div>
          {isAtLimit && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              Limit Reached
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Referral Link */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Your Referral Link</label>
          <div className="flex gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 font-mono truncate">
              {stats.referralLink}
            </div>
            <Button
              onClick={handleCopyLink}
              variant="outline"
              size="sm"
              className="flex-shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Share this link with friends. They'll get 10 free enhancements when they sign up!
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total Referrals</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{stats.totalReferrals}</p>
            <p className="text-xs text-blue-700 mt-1">
              {stats.completedReferrals} completed
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Rewards Earned</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">{stats.rewardsEarned}</p>
            <p className="text-xs text-purple-700 mt-1">
              {remainingCapacity > 0 ? `${remainingCapacity} remaining` : 'Limit reached'}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {!isAtLimit && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Progress to limit</span>
              <span className="font-medium text-gray-900">
                {stats.rewardsEarned} / {stats.rewardsLimit}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (stats.rewardsEarned / stats.rewardsLimit) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Recent Referrals */}
        {stats.referrals.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Recent Referrals</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {stats.referrals.slice(0, 5).map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        referral.status === 'rewarded'
                          ? 'bg-green-500'
                          : referral.status === 'completed'
                          ? 'bg-yellow-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    <span className="text-gray-700">
                      {referral.status === 'pending'
                        ? 'Pending onboarding'
                        : referral.status === 'completed'
                        ? 'Onboarding complete'
                        : 'Reward awarded'}
                    </span>
                  </div>
                  {referral.referrerRewarded && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <Sparkles className="w-3 h-3 mr-1" />
                      +20
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Messages */}
        {stats.referrals.length === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">No referrals yet</p>
                <p className="text-blue-700">
                  Share your referral link to start earning rewards! Each friend who completes onboarding earns you 20 enhancements.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status Messages for Pending Referrals */}
        {stats.referrals.some((r) => r.status === 'pending' || r.status === 'completed') && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-medium mb-1">Pending Rewards</p>
                <p className="text-amber-700">
                  {stats.referrals.filter((r) => r.status === 'pending').length > 0 && (
                    <>
                      {stats.referrals.filter((r) => r.status === 'pending').length} referred user
                      {stats.referrals.filter((r) => r.status === 'pending').length !== 1 ? 's' : ''} haven't completed onboarding yet — reward pending.
                    </>
                  )}
                  {stats.referrals.filter((r) => r.status === 'completed' && !r.referrerRewarded).length > 0 && (
                    <>
                      {stats.referrals.filter((r) => r.status === 'pending').length > 0 && ' '}
                      {stats.referrals.filter((r) => r.status === 'completed' && !r.referrerRewarded).length} referral
                      {stats.referrals.filter((r) => r.status === 'completed' && !r.referrerRewarded).length !== 1 ? 's' : ''} completed — rewards will be awarded soon.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

